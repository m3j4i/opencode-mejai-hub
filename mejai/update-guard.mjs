import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';import net from 'node:net';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function historyIDs(file){
 try{await fs.access(file);}catch{return null;}
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(file,{readOnly:true});
 try{const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);const result={};for(const table of ['session','message','part'])if(tables.includes(table))result[table]=db.prepare('SELECT id FROM "'+table+'"').all().map(r=>r.id);return result;}finally{db.close();}
}
export async function backupBeforeUpdate(base,folder,executable){
 const entries=[];
 async function copy(relative){const source=path.join(base,relative);let s;try{s=await fs.lstat(source);}catch(e){if(e.code==='ENOENT')return;throw e;}if(s.isSymbolicLink())throw Error('Update backup refuses symbolic links: '+relative);if(s.isDirectory()){for(const n of await fs.readdir(source))await copy(path.join(relative,n));return;}if(!s.isFile())return;const bytes=await fs.readFile(source),target=path.join(folder,'kit',relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);entries.push({path:relative,sha256:sha(bytes),bytes:bytes.length});}
 for(const e of await fs.readdir(base,{withFileTypes:true}))if(e.isFile()&&/\.(json|md|mjs|ps1|cmd|sh)$/.test(e.name))await copy(e.name);
 for(const relative of ['plugins','lib','skills','ui','dados/opencode-data','dados/opencode-state','dados/opencode-config','dados/conexoes.json'])await copy(relative);
 await fs.copyFile(executable,path.join(folder,'previous-executable'));const binaryHash=sha(await fs.readFile(executable));
 await fs.writeFile(path.join(folder,'backup-manifest.json'),JSON.stringify({created:new Date().toISOString(),binaryHash,files:entries},null,2));return entries;
}
export async function unchanged(base,entries){for(const e of entries){if(sha(await fs.readFile(path.join(base,e.path)))!==e.sha256)throw Error('A protected file changed while updating: '+e.path+'. Nothing was replaced.');}}
export async function compatibilityProbe(candidate,stage,sourceConfig,env){
 const root=path.join(stage,'probe');await fs.mkdir(root,{recursive:true});
 const config=structuredClone(sourceConfig);config.autoupdate=false;config.mcp={};config.instructions=[];config.skills={paths:[]};
 const copiedPlugins=path.join(stage,'kit/plugins');config.plugin=(config.plugin||[]).map(p=>pathToFileURL(path.join(copiedPlugins,path.basename(new URL(p).pathname))).href);
 const configFile=path.join(root,'opencode.json');await fs.writeFile(configFile,JSON.stringify(config));
 const clean={...env,OPENCODE_CONFIG:configFile,OPENCODE_CONFIG_CONTENT:'',OPENCODE_DISABLE_AUTOUPDATE:'true',OPENCODE_DISABLE_MODELS_FETCH:'true',AGENTE_LOCAL_HOME:root};
 for(const key of ['HOME','USERPROFILE','APPDATA','LOCALAPPDATA','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_STATE_HOME','XDG_CACHE_HOME','TEMP','TMP']){clean[key]=path.join(root,key);await fs.mkdir(clean[key],{recursive:true});}
 const oldData=path.join(stage,'kit/dados/opencode-data');try{await fs.access(oldData);await fs.cp(oldData,clean.XDG_DATA_HOME,{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
 const packages=path.join(stage,'kit/dados/opencode-config/opencode/node_modules');try{await fs.access(packages);await fs.cp(packages,path.join(clean.XDG_CONFIG_HOME,'opencode/node_modules'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
 const dbFile=path.join(clean.XDG_DATA_HOME,'opencode/opencode.db'),before=await historyIDs(dbFile);
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(candidate,['serve','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:clean,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='',exited=false;child.on('error',e=>{log+=e.message;exited=true;});child.on('exit',()=>exited=true);for(const stream of [child.stdout,child.stderr])stream.on('data',b=>log=(log+b).slice(-6000));
 try{let ready=false;for(let i=0;i<90&&!exited;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/config',{signal:AbortSignal.timeout(2000)});if(r.ok){const actual=await r.json();if(actual.model!==config.model)throw Error('Selected model was not preserved.');ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
  if(!ready)throw Error('Candidate failed isolated startup/configuration checks: '+log);
  const spec=await(await fetch('http://127.0.0.1:'+port+'/doc',{signal:AbortSignal.timeout(10000)})).json();
  for(const route of ['/session/{sessionID}/prompt_async','/session/{sessionID}/abort','/session/status'])if(!spec.paths?.[route])throw Error('Required OpenCode API is missing: '+route);
  const model=config.model||'';const slash=model.indexOf('/');if(slash>0){const toolResponse=await fetch('http://127.0.0.1:'+port+'/experimental/tool?provider='+encodeURIComponent(model.slice(0,slash))+'&model='+encodeURIComponent(model.slice(slash+1)),{signal:AbortSignal.timeout(60000)});if(!toolResponse.ok)throw Error('Candidate failed tool/plugin initialization.');await toolResponse.json();}
  const after=await historyIDs(dbFile);if(before)for(const [table,ids] of Object.entries(before)){const kept=new Set(after?.[table]||[]);if(ids.some(id=>!kept.has(id)))throw Error('Candidate did not preserve all '+table+' records in the isolated copy.');}
  return {startup:true,configuration:true,plugins:config.plugin.length,api:true,history:before?'all existing session/message/part IDs preserved in copied database':'no prior database',inference:'not tested',mcp:'external services not started'};
 }finally{if(!exited){child.kill();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,5000).unref();});}await fs.writeFile(path.join(stage,'compatibility.log'),log);}
}
