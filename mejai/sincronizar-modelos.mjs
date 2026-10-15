import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeTextAtomic} from './lib/storage.mjs';
export const root=path.dirname(fileURLToPath(import.meta.url));
const ollama=process.env.AGENTE_OLLAMA_URL||'http://127.0.0.1:11434';
const server=process.env.AGENTE_SERVER_URL||'http://127.0.0.1:4096';
async function request(url,options={}) {
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error(`${url}: HTTP ${r.status}`);
 return r.json();
}
export function modelEntry(tag,show) {
 const caps=show.capabilities||[];
 if(caps.includes('embedding')&&!caps.includes('completion'))return null;
 const configured=Number(show.parameters?.match(/num_ctx\s+(\d+)/)?.[1]);
 const maximum=Object.entries(show.model_info||{}).find(([k])=>k.endsWith('.context_length'))?.[1];
 const context=Math.max(512,Math.min(configured||4096,Number(maximum)||configured||4096));
 const tools=caps.includes('tools');
 return {name:tag.name+(tools?'':' (tool support not declared)'),tool_call:tools,
  modalities:{input:caps.includes('vision')?['text','image']:['text'],output:['text']},
  limit:{context,output:Math.min(8192,Math.floor(context/4))}};
}
export async function sync({initial=false,base=root,endpoint=ollama,api=server,configFile}={}) {
 // An unreachable Ollama or a failed metadata request must never erase the catalog.
 const tags=(await request(endpoint+'/api/tags')).models;
 if(!Array.isArray(tags))throw Error('Invalid response from Ollama.');
 const file=configFile||path.join(base,'opencode.json');
 const original=await fs.readFile(file,'utf8');
 const config=JSON.parse(original.replace(/^\uFEFF/,''));
 const cachePath=path.join(base,'logs','catalogo-ollama.json');
 let cache={};try{cache=JSON.parse(await fs.readFile(cachePath,'utf8'));}catch{}
 const nextCache={};
 const models={};
 for(const tag of [...tags].sort((a,b)=>a.name.localeCompare(b.name))) {
  const key='context-v2|'+endpoint+'|'+tag.name+'|'+tag.digest;
  let entry;
  if(Object.hasOwn(cache,key))entry=cache[key];
  else {
   const show=await request(endpoint+'/api/show',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:tag.name})});
   entry=modelEntry(tag,show);
  }
  nextCache[key]=entry;if(entry)models[tag.name]=entry;
 }
 await fs.mkdir(path.dirname(cachePath),{recursive:true});
 await fs.writeFile(cachePath,JSON.stringify(nextCache));
 const previous=config.provider.ollama.models;
 const available=Object.keys(models);
 if(!available.length)throw Error('No chat model is available in Ollama.');
 config.provider.ollama.models=models;
 config.provider.ollama.options.baseURL=endpoint+'/v1';
 for(const field of ['model','small_model']) {
  if(config[field]&&!config[field].startsWith('ollama/'))continue;
  const current=config[field]?.replace(/^ollama\//,'');
  if(models[current])continue;
  const selected=models[current+':latest']?current+':latest':available.find(n=>models[n].tool_call)||available[0];
  config[field]='ollama/'+selected;
 }
 const changed=JSON.stringify(previous)!==JSON.stringify(models)||JSON.stringify(JSON.parse(original.replace(/^\uFEFF/,'')))!==JSON.stringify(config);
 if(!changed)return {changed:false,models:available};
 if(!initial) {
  const status=await request(api+'/session/status');
  if(Object.values(status).some(s=>s.type!=='idle'))return {changed:false,pending:true,models:available};
 }
 // Avoid clobbering a configuration edited by the agent during discovery.
 if(await fs.readFile(file,'utf8')!==original)throw Error('Configuration changed during discovery; retrying later.');
 await writeTextAtomic(file,JSON.stringify(config,null,2)+'\n');
 if(!initial) {
  try {await request(api+'/global/dispose',{method:'POST'});}
  catch(error) {await writeTextAtomic(file,original);throw error;}
 }
 return {changed:true,models:available};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {console.log(JSON.stringify(await sync({initial:process.argv.includes('--initial')})));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
