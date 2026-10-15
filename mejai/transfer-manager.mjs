import fs from 'node:fs/promises';
import {createReadStream,constants} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {invalidArtifact} from './plugins/execution-core.mjs';
import {archiveIntegrity} from './archive-integrity.mjs';
export function validateRange(status,range,offset,total){
 if(!offset){if(status!==200)throw Error('Unexpected initial response: HTTP '+status);return;}
 const m=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(range||'');
 if(status!==206||!m||Number(m[1])!==offset||Number(m[3])!==total||Number(m[2])!==total-1)throw Error('Resume rejected: response does not match the partial download. File preserved.');
}
export function transferManager({base,directory,records,persist,tasks,cookies=async()=>''}){
 const active=new Map();
 async function receive(record,signal){
  const stat=await fs.stat(record.partPath).catch(()=>null),offset=stat?.size||0;
  const network=new AbortController();let timer;const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>network.abort(Error('Conexao sem progresso por 120 segundos; parcial preservado.')),120000);};touch();
  try{
  if(offset&&(!record.total||!record.validator))throw Error('Missing size or identity for safe resumption; partial download preserved.');
  let url=record.url,headers={'Accept-Encoding':'identity'};
  const cookie=await cookies(url);if(cookie)headers.Cookie=cookie;
  if(offset){headers.Range='bytes='+offset+'-';headers['If-Range']=record.validator;}
  let response;
  for(let i=0;i<6;i++){
   response=await fetch(url,{headers,redirect:'manual',signal:AbortSignal.any([signal,network.signal])});
   if([301,302,303,307,308].includes(response.status)){
    const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Redirect has no destination.');
    const next=new URL(location,url);if(!['http:','https:'].includes(next.protocol))throw Error('Invalid redirect destination.');
    if(next.origin!==new URL(url).origin)delete headers.Cookie;
    url=next.href;response=undefined;continue;
   }break;
  }
  if(!response)throw Error('Too many redirects.');
  try{
   validateRange(response.status,response.headers.get('content-range'),offset,record.total);
   if(/html|json|xml/i.test(response.headers.get('content-type')||''))throw Error('Server returned a page or document instead of a binary file. Use the browser to find the real link.');
   if(!['','identity'].includes(response.headers.get('content-encoding')||''))throw Error('Response encoding prevents byte verification.');
   if(offset&&response.headers.get(record.validatorHeader||'etag')!==record.validator)throw Error('Remote identity changed; partial download preserved.');
   if(!offset){
    const length=Number(response.headers.get('content-length'));record.total=length>0?length:null;
    const etag=response.headers.get('etag');record.validatorHeader=etag&&!etag.startsWith('W/')?'etag':'last-modified';record.validator=response.headers.get(record.validatorHeader);
   }
   record.bytes=offset;record.resolvedURL=url;await persist();
   const handle=await fs.open(record.partPath,stat?'a':'wx');
   try{for await(const chunk of response.body){touch();
    if(record.total&&record.bytes+chunk.length>record.total)throw Error('Response exceeds expected size; partial download preserved.');
    let written=0;while(written<chunk.length){const result=await handle.write(chunk,written,chunk.length-written);if(!result.bytesWritten)throw Error('Write made no progress.');written+=result.bytesWritten;}
    record.bytes+=chunk.length;
   }}finally{await handle.close();}
   if(record.total&&record.bytes!==record.total)throw Error('Incomplete download; partial download preserved.');
   if(!record.bytes)throw Error('Empty file.');
  }catch(e){await response.body?.cancel().catch(()=>{});throw e;}
  }finally{clearTimeout(timer);}
 }
 function launch(record){
  if(active.has(record.id))return record;
  const control=new AbortController();active.set(record.id,control);record.status='recebendo';delete record.error;
  const task=(async()=>{try{
   await receive(record,control.signal);
   const bad=invalidArtifact(record.partPath,path.extname(record.path));if(bad)throw Error(bad);
   record.status='verificando';await persist();
   const hash=createHash('sha256');for await(const chunk of createReadStream(record.partPath))hash.update(chunk);record.sha256=hash.digest('hex');
   // Link fails if an unrelated file already occupies the final name; never overwrite it.
   await fs.copyFile(record.partPath,record.path,constants.COPYFILE_EXCL);await fs.unlink(record.partPath);
   record.integrity=await archiveIntegrity(record.path,base);
   if(record.integrity.status==='falhou')throw Error(record.integrity.message);
   record.status=record.integrity.status==='senha_necessaria'?'aguarda_senha':'concluido';
  }catch(e){record.status=record.status==='verificando'?'falhou':'interrompido';record.error=e.message;record.bytes=await fs.stat(record.partPath).then(s=>s.size).catch(()=>record.bytes||0);}
  finally{active.delete(record.id);record.finished=new Date().toISOString();await persist();}})();
  tasks.add(task);task.then(()=>tasks.delete(task),error=>{
   tasks.delete(task);record.status='falhou';record.error='Failed to record transfer: '+error.message;
  });return record;
 }
 return {
  async start(url,filename){
   if(process.env.AGENTE_BROWSER_PROXY)throw Error('Use browser_download to preserve the Tor proxy; direct transfer is unavailable in this profile.');
   const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Use a discovered HTTP/HTTPS URL without embedded credentials.');
   const name=String(filename||path.basename(parsed.pathname)||'arquivo.bin').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(-140)||'arquivo.bin';
   const id=randomUUID(),file=path.join(directory,id+'-'+name);
   const record={id,url:parsed.href,path:file,partPath:file+'.part',filename:name,kind:'transferencia',status:'recebendo',bytes:0,started:new Date().toISOString()};
   records.push(record);await persist();return launch(record);
  },
  resume(id){const r=records.find(r=>r.id===id&&r.kind==='transferencia');if(!r)throw Error('Transfer ID not found.');if(r.status!=='interrompido')throw Error('Resume is available only for interrupted transfers.');if(process.env.AGENTE_BROWSER_PROXY)throw Error('Direct resume is unavailable in the Tor profile.');return launch(r);},
  cancel(id){const control=active.get(id);if(!control||records.find(r=>r.id===id)?.status!=='recebendo')return false;control.abort(Error('Transfer cancelled; partial download preserved.'));return true;},
  stop(){for(const control of active.values())control.abort(Error('Servidor encerrado; parcial preservado.'));},
  busy(){return active.size>0;}
 };
}
