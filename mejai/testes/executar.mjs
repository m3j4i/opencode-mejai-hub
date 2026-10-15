import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const reportDirectory=path.join(base,'logs/validacao');
await fs.mkdir(reportDirectory,{recursive:true});
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mejai-tests-'));
await fs.mkdir(path.join(directory,'temp'));
await fs.mkdir(path.join(directory,'work'),{recursive:true});
const names=['inline-scripts','torch','chat-improvements','attachment-parts','chat-stream','hub-storage','thinking-watchdog','long-session','autonomy','autonomy-events','update-guard','first-message','colibri','mejai-reliability','content-completeness','review-fixes','model-sync','session-relocation','empty-recovery','browser-fixes','transfers','artifact-syntax','url-evidence','delete-conversations','editor','reset','portable-core','session-review'].filter(name=>process.platform==='win32'||!['editor','reset'].includes(name));
const results=[];
for(const name of names){
 const result=await new Promise(resolve=>{
  const command=['editor','reset'].includes(name)?'powershell.exe':process.execPath;
  const args=['editor','reset'].includes(name)?['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(base,'testes/unit/test-'+name+'.ps1')]:[path.join(base,'testes/unit/test-'+name+'.mjs')];
  const child=spawn(command,args,{cwd:directory,windowsHide:true,env:{...process.env,AGENTE_LOCAL_HOME:base,TEMP:path.join(directory,'temp'),TMP:path.join(directory,'temp')}});
  let output='';const append=b=>{output=(output+b).slice(-20000);};child.stdout.on('data',append);child.stderr.on('data',append);
  const timer=setTimeout(()=>child.kill(),120000);
  child.on('error',error=>append(error.message));child.on('close',code=>{clearTimeout(timer);resolve({name,ok:code===0,output});});
 });results.push(result);console.log((result.ok?'[OK] ':'[FAIL] ')+name);if(!result.ok)console.log(result.output);
}
await fs.writeFile(path.join(reportDirectory,'resultado.json'),JSON.stringify({time:new Date().toISOString(),results},null,2));
console.log('Isolated tests: no Ollama prompts and no real conversations deleted.');
if(results.some(r=>!r.ok))process.exitCode=1;

console.log('Isolated fixtures: '+directory);
if(!results.some(r=>!r.ok)&&path.dirname(directory)===path.resolve(os.tmpdir())&&path.basename(directory).startsWith('mejai-tests-'))await fs.rm(directory,{recursive:true,force:true});
