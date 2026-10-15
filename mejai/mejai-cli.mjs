import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';import {base,bin,windows} from './platform.mjs';
async function main(){
const action=process.argv[2]||'hub',quiet=process.argv.includes('--quiet');
async function existing(){try{const c=JSON.parse(await fs.readFile(path.join(base,'dados','hub-'+process.platform+'.json')));const r=await fetch(c.url+'/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok&&(await r.json()).base===base)return c;}catch{}return null;}
let connection=await existing();if(!connection){const p=spawn(bin.node,[path.join(base,'hub.mjs')],{cwd:base,env:{...process.env,MEJAI_NO_BROWSER:'1'},detached:true,windowsHide:true,stdio:'ignore'});p.on('error',e=>{console.error(e.message);process.exitCode=1;});p.unref();for(let i=0;i<100&&!connection;i++){await new Promise(r=>setTimeout(r,100));connection=await existing();}}
if(!connection)throw Error('MEJAI hub did not start. Inspect the kit logs.');
let url=connection.url+'/#'+connection.token;
if(action==='start'||action==='stop'||action==='chat'){const response=await fetch(connection.url+'/api/'+action,{method:'POST',headers:{'X-Mejai-Token':connection.token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(120000)});const value=await response.json();if(!response.ok)throw Error(value.error||'Hub request failed.');if(action==='stop'){console.log('Agent stopped.');return;}url=value.url;}
else if(action!=='hub')throw Error('Supported commands: hub, chat, start, stop.');
if(!quiet){const p=spawn(windows?'rundll32.exe':'xdg-open',windows?['url.dll,FileProtocolHandler',url]:[url],{windowsHide:true,stdio:'ignore'});p.on('error',e=>console.error('Open the hub with its launcher: '+e.message));p.unref();}
console.log(['start','chat'].includes(action)?'Chat ready.':'Hub ready.');

}
await main().catch(error=>{console.error(error.message);process.exitCode=1;});
