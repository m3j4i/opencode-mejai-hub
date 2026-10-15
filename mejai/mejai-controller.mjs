import {runtimeStatus} from './runtime-status.mjs';
import fs from 'node:fs/promises';import fss from 'node:fs';import path from 'node:path';import net from 'node:net';import {spawn,execFile} from 'node:child_process';import {promisify} from 'node:util';import {pathToFileURL} from 'node:url';import {createHash,randomUUID} from 'node:crypto';
import {base,bin,runtime,windows,environment} from './platform.mjs';
import {writeTextAtomic} from './lib/storage.mjs';import {sync} from './sincronizar-modelos.mjs';
import {relocate} from './localizar-sessoes.mjs';
import * as colibri from './colibri-provider.mjs';
import {createPreparation} from './first-message.mjs';
export const run=promisify(execFile);
export const configNames=['INSTRUCOES.md','RECUPERACAO.md','WEB-E-MCP.md','LANGUAGE.md','navegador-preferencias.json','dados/conexoes.json'];
const hash=text=>createHash('sha256').update(text).digest('hex');
export async function readConfig(name){if(!configNames.includes(name))throw Error('Unknown configuration file.');let text;try{text=await fs.readFile(path.join(base,name),'utf8');}catch(e){if(e.code!=='ENOENT'||name!=='dados/conexoes.json')throw e;text=await fs.readFile(path.join(base,'conexoes.exemplo.json'),'utf8');}return {name,text,revision:hash(text)};}
export async function saveConfig({name,text,revision}){const current=await readConfig(name);if(current.revision!==revision)throw Error('The file changed outside this editor. Reload it before saving.');if(typeof text!=='string'||!text.trim())throw Error('The configuration cannot be empty.');if(name.endsWith('.json')){const value=JSON.parse(text);if(name==='navegador-preferencias.json'&&!['camoufox','chromium'].includes(value.engine))throw Error('engine must be camoufox or chromium.');}await writeTextAtomic(path.join(base,name),text);return readConfig(name);}
const connectionFile=path.join(base,'dados','connection-'+process.platform+'.json');
let child=null,monitor=null,lastError=null;
let serverRunID=randomUUID();
export async function api(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(6000)});if(!response.ok)throw Error('HTTP '+response.status);const text=await response.text();return text?JSON.parse(text):{ok:true};}
export async function findServer(){
 let saved;try{saved=JSON.parse(await fs.readFile(connectionFile));}catch{}
 const ports=[...new Set([saved?.port,...Array.from({length:31},(_,i)=>4096+i)].filter(Boolean))];
 for(const port of ports){try{const config=await api('http://127.0.0.1:'+port+'/config');if(config.instructions?.includes(path.join(base,'INSTRUCOES.md')))return {port,url:'http://127.0.0.1:'+port,pid:saved?.port===port?saved.pid:null,runID:saved?.port===port?saved.runID:null,legacy:!config.instructions.includes(path.join(base,'LANGUAGE.md'))||!config.provider?.colibri||!config.plugin?.some(p=>p.endsWith('/autonomy.mjs'))};}catch{}}
 return null;
}
export async function state(){const server=await findServer();let progress;try{progress=JSON.parse(await fs.readFile(path.join(base,'dados/progresso/atual.json')));}catch{}return {name:'MEJAI',platform:process.platform,server,progress,error:lastError,preparation:preparation.state(),runtime:await runtimeStatus(base,server,api)};}
export async function prepare(){
 const env=environment();await relocate(base);try{await sync({initial:true});lastError=null;}catch(e){lastError='Model discovery unavailable. Check that Ollama is running. The previous catalog is preserved and discovery will retry automatically. '+e.message;}
 await colibri.sync({initial:true}).catch(e=>{lastError='Colibri discovery: '+e.message;});
 const config=JSON.parse((await fs.readFile(path.join(base,'opencode.json'),'utf8')).replace(/^\uFEFF/,''));
 const selectedContext=config.provider?.[config.model?.split('/')[0]]?.models?.[config.model?.slice(config.model.indexOf('/')+1)]?.limit?.context||4096;
 config.compaction={...config.compaction,auto:true,prune:true,reserved:Math.min(32768,Math.floor(selectedContext/4))};
 config.provider.colibri??=colibri.emptyProvider();config.enabled_providers=[...new Set([...(config.enabled_providers||['ollama']),'colibri'])];
 config.instructions=['INSTRUCOES.md','RECUPERACAO.md','WEB-E-MCP.md','LANGUAGE.md'].map(x=>path.join(base,x));
 config.plugin=['url-evidence.mjs','execution-checks.mjs','empty-recovery.mjs','assurance.mjs','http-retry.mjs','autonomy.mjs'].map(x=>pathToFileURL(path.join(base,'plugins',x)).href);
 config.skills={...config.skills,paths:[path.join(base,'skills')]};
 for(const key of ['playwright','memory','context7','deepwiki'])if(config.mcp[key])config.mcp[key].enabled=false;
 config.mcp.habilidades={type:'local',enabled:true,command:[bin.node,path.join(base,'habilidades.mjs')],timeout:150000};
 const configFile=path.join(base,'dados','config-'+process.platform+'.json');await writeTextAtomic(configFile,JSON.stringify(config,null,2));env.OPENCODE_CONFIG=configFile;
 env.PLAYWRIGHT_BROWSERS_PATH=runtime('browsers');process.env.PLAYWRIGHT_BROWSERS_PATH=env.PLAYWRIGHT_BROWSERS_PATH;
 const {chromium}=await import(pathToFileURL(runtime('browser/node_modules/playwright/index.mjs')));
 let executablePath=chromium.executablePath();if(windows){try{const old=JSON.parse(await fs.readFile(path.join(base,'navegador-config.json')));await fs.access(old.executablePath);executablePath=old.executablePath;}catch{}}
 const prefs=JSON.parse(await fs.readFile(path.join(base,'navegador-preferencias.json')));await writeTextAtomic(path.join(base,'navegador-config.json'),JSON.stringify({...prefs,executablePath}));
 const mcpHome=path.join(base,'dados',windows?'mcp-home':'mcp-home-linux');const dc=path.join(mcpHome,'.claude-server-commander');await fs.mkdir(dc,{recursive:true});let existingDC={};try{existingDC=JSON.parse(await fs.readFile(path.join(dc,'config.json'),'utf8'));}catch{}await writeTextAtomic(path.join(dc,'config.json'),JSON.stringify({...existingDC,telemetryEnabled:false,defaultShell:bin.shell,allowedDirectories:existingDC.allowedDirectories||[base],logging:{...existingDC.logging,enabled:false}}));
 const dap=path.join(mcpHome,windows?'AppData/Roaming/debugmcp':'.config/debugmcp');await fs.mkdir(dap,{recursive:true});let previousDAP={};try{previousDAP=JSON.parse(await fs.readFile(path.join(dap,'config.json'),'utf8'));}catch{}await writeTextAtomic(path.join(dap,'config.json'),JSON.stringify({...previousDAP,version:1,adapters:{...previousDAP.adapters,python:{command:bin.python,args:['-m','debugpy.adapter'],type:'python',extensions:['.py'],transport:'stdio',launch:{python:bin.python}}}}));
 return {env,configFile};
}
async function freePort(){const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=server.address().port;await new Promise(r=>server.close(r));return port;}
export async function start(){const existing=await findServer();if(existing&&!existing.legacy){attachMonitor(existing);prepareFirstMessage(existing);return existing;}if(existing?.legacy)await stop();const {env,configFile}=await prepare();await fs.mkdir(path.join(base,'tarefas'),{recursive:true});await fs.mkdir(path.join(base,'logs'),{recursive:true});const port=await freePort();
 serverRunID=randomUUID();const out=fss.openSync(path.join(base,'logs/mejai-server.log'),'a');child=spawn(bin.opencode,['serve','--hostname','127.0.0.1','--port',String(port)],{cwd:path.join(base,'tarefas'),env:{...env,MEJAI_RUN_ID:serverRunID,AGENTE_SERVER_URL:'http://127.0.0.1:'+port},detached:true,windowsHide:true,stdio:['ignore',out,out]});child.unref();fss.closeSync(out);
 child.on('error',e=>{lastError=e.message;});child.on('exit',()=>{child=null;clearInterval(monitor);});
 await fs.writeFile(connectionFile,JSON.stringify({port,pid:child.pid,runID:serverRunID,platform:process.platform}));
 for(let i=0;i<120;i++){if(!child)throw Error(lastError||'OpenCode exited. Read logs/mejai-server.log.');try{await api('http://127.0.0.1:'+port+'/global/health');attachMonitor({url:'http://127.0.0.1:'+port});prepareFirstMessage({url:'http://127.0.0.1:'+port});return {port,url:'http://127.0.0.1:'+port,pid:child.pid,runID:serverRunID};}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('OpenCode did not become ready. Read logs/mejai-server.log.');
}
export async function stop(){preparationVersion++;preparation.cancel();const server=await findServer();if(!server)return {stopped:true,alreadyStopped:true};const states=await api(server.url+'/session/status');if(Object.values(states).some(s=>s.type!=='idle'))throw Error('The agent is working. Cancel the task in the chat or wait for it to finish.');
 // Dispose through the verified local API before stopping the process owned by this launcher.
 if(child){child.kill();await new Promise(r=>{if(!child)return r();child.once('exit',r);setTimeout(r,5000).unref();});}
 else if(server.pid){
  let executable;
  if(windows){const result=await run('powershell.exe',['-NoProfile','-Command','(Get-Process -Id '+Number(server.pid)+' -ErrorAction Stop).Path'],{windowsHide:true});executable=result.stdout.trim();}
  else executable=await fs.readlink('/proc/'+Number(server.pid)+'/exe');
  const actual=await fs.realpath(executable),expected=await fs.realpath(bin.opencode);
  if((windows?actual.toLowerCase():actual)!==(windows?expected.toLowerCase():expected))throw Error('Process ownership could not be confirmed. Stop its launcher before maintenance.');
  process.kill(server.pid);
  for(let attempt=0;attempt<50;attempt++){try{await api(server.url+'/global/health');}catch{break;}await new Promise(r=>setTimeout(r,100));}
 }
 else if(windows){const expected=bin.opencode.replaceAll("'","''");const command="$ErrorActionPreference='Stop'; $listeners=Get-NetTCPConnection -LocalPort "+Number(server.port)+" -State Listen; foreach($listener in $listeners){$owned=Get-Process -Id $listener.OwningProcess; if($owned.Path -ne '"+expected+"'){throw 'Server ownership mismatch'}; [Diagnostics.Process]::GetProcessById($owned.Id).Kill()}";await run('powershell.exe',['-NoProfile','-Command',command],{windowsHide:true});}
 else throw Error('This agent was started outside this hub. Stop its launcher before maintenance.');
 clearInterval(monitor);await fs.unlink(connectionFile).catch(()=>{});return {stopped:true};
}
export async function idleRequired(){if(await findServer())throw Error('Stop the agent before this operation.');}
export async function diagnostics(){const results=[];for(const [name,command,args] of [['Node',bin.node,['--version']],['Python',bin.python,['--version']],['Shell',bin.shell,windows?['-NoProfile','-Command','$PSVersionTable.PSVersion.ToString()']:['--version']],['Git',bin.git,['--version']],['OpenCode',bin.opencode,['--version']]]){try{const result=await run(command,args,{env:environment(),timeout:15000,windowsHide:true});results.push({name,ok:true,detail:result.stdout.trim()});}catch(e){results.push({name,ok:false,detail:e.message});}}try{results.push({name:'Ollama',ok:true,detail:await api((process.env.AGENTE_OLLAMA_URL||'http://127.0.0.1:11434')+'/api/version')});}catch(e){results.push({name:'Ollama',ok:false,detail:e.message});}return results;}
export async function openLocal(kind){if(!['tarefas','downloads'].includes(kind))throw Error('Unknown folder.');const folder=path.join(base,kind);await fs.mkdir(folder,{recursive:true});await new Promise((resolve,reject)=>{const p=spawn(windows?'explorer.exe':'xdg-open',[folder],{detached:true,windowsHide:false,stdio:'ignore'});p.once('error',reject);p.once('spawn',()=>{p.unref();resolve();});});return {folder,opened:true};}
export async function releaseInfo(){return JSON.parse(await fs.readFile(path.join(base,'fork.json'),'utf8'));}
export async function update(){throw Error('Official updates are disabled for the mejai hub fork. Install only a tested fork build.');}

export async function newConversation(){
 const preferred=JSON.parse((await fs.readFile(path.join(base,'opencode.json'),'utf8')).replace(/^\uFEFF/,''));
 if(preferred.model?.startsWith('colibri/')){const found=await colibri.discovered();if(!found||!found.models[preferred.model.slice(8)])throw Error('The selected Colibri model is not ready. Start Colibri or select Ollama in Models and providers.');}
 const server=await start();const directory=path.join(base,'tarefas');await fs.mkdir(directory,{recursive:true});
 const session=await api(server.url+'/session?directory='+encodeURIComponent(directory),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 if(!/^ses_[a-zA-Z0-9]+$/.test(session?.id||''))throw Error('OpenCode did not return a valid conversation ID.');
 const route=Buffer.from(directory,'utf8').toString('base64url');
 return {id:session.id,url:server.url+'/'+route+'/session/'+session.id};
}


let discoveryPaused=false,discoveryRunning=null;
export async function pauseDiscovery(){discoveryPaused=true;await discoveryRunning;}
export function resumeDiscovery(){discoveryPaused=false;}
function attachMonitor(server){
 clearInterval(monitor);
 const configFile=path.join(base,'dados','config-'+process.platform+'.json');
 const tick=()=>{if(discoveryPaused||discoveryRunning)return;discoveryRunning=(async()=>{
  const errors=[];
  try{await sync({api:server.url,configFile});}catch(e){errors.push('Ollama discovery: '+e.message);}
  try{await colibri.sync({api:server.url,configFile});}catch(e){errors.push('Colibri discovery: '+e.message);}
  lastError=errors.length?errors.join(' '):null;
 })().finally(()=>{discoveryRunning=null;});};
 monitor=setInterval(tick,30000);monitor.unref();
}
export async function resumeMonitor(){const server=await findServer();if(server&&!server.legacy)attachMonitor(server);}
async function requireNoActiveTask(){const server=await findServer();if(server){const states=await api(server.url+'/session/status');if(Object.values(states).some(s=>s.type!=='idle'))throw Error('The agent is working. Cancel its task or wait before changing providers.');}return server;}
export async function providers(){
 const config=JSON.parse((await fs.readFile(path.join(base,'opencode.json'),'utf8')).replace(/^\uFEFF/,''));
 const info=await colibri.state();const result={selected:config.model,ollama:config.provider?.ollama?.models||{},colibri:info};
 try{result.colibri.models=(await colibri.discovered())?.models||{};}catch(e){result.colibri.error=e.message;result.colibri.models={};}
 return result;
}
export async function chooseProvider({provider,model}){
 if(!['ollama','colibri'].includes(provider)||typeof model!=='string')throw Error('Choose an available provider and model.');
 await requireNoActiveTask();
 const file=path.join(base,'opencode.json');const original=await fs.readFile(file,'utf8');const config=JSON.parse(original.replace(/^\uFEFF/,''));
 if(provider==='colibri'){const found=await colibri.discovered();if(!found)throw Error('Start Colibri and wait until its model is ready.');config.provider.colibri=found;}
 if(!Object.hasOwn(config.provider?.[provider]?.models||{},model))throw Error('The chosen model is not available.');
 // Dispose the idle server before changing its default; existing conversations are preserved.
 await stop();
 if(await fs.readFile(file,'utf8')!==original)throw Error('Configuration changed. Refresh and select again.');
 config.enabled_providers=[...new Set([...(config.enabled_providers||['ollama']),'ollama','colibri'])];
 config.model=provider+'/'+model;config.small_model=config.model;
 await writeTextAtomic(file,JSON.stringify(config,null,2)+'\n');return {selected:config.model};
}
export async function saveColibri(value){await requireNoActiveTask();return colibri.save(value);}
export async function startColibri(){await requireNoActiveTask();return colibri.start();}
export async function stopColibri(){await requireNoActiveTask();return colibri.stop();}
export async function colibriLogs(){return colibri.logs();}

let preparationVersion=0;
const preparation=createPreparation({onChange:value=>{
 fs.mkdir(path.join(base,'logs'),{recursive:true}).then(()=>fs.appendFile(path.join(base,'logs/first-message-'+process.platform+'.jsonl'),JSON.stringify({time:new Date().toISOString(),...value})+'\n')).catch(()=>{});
}});
function prepareFirstMessage(server){
 const version=preparationVersion;
 fs.readFile(path.join(base,'opencode.json'),'utf8').then(text=>{
  if(version!==preparationVersion||process.env.MEJAI_PREWARM==='0')return;
  return preparation.begin({server:server.url,config:JSON.parse(text.replace(/^\uFEFF/,'')),directory:path.join(base,'tarefas')});
 }).catch(()=>{});
}
export async function warmup(){const server=await findServer();if(server&&!server.legacy){prepareFirstMessage(server);return {scheduled:true};}return {scheduled:false};}









export {activity,enableAutonomy,pauseAutonomy,streamActivity,reopenConversation} from './src/services/autonomy-service.mjs';
