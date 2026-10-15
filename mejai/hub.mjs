import {scanLanguages} from './src/repositories/language-repository.mjs';
import * as chat from './chat-api.mjs';
import {versions,snapshot,restore} from './code-versions.mjs';
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {randomBytes} from 'node:crypto';import {spawn} from 'node:child_process';import {base,windows,bin} from './platform.mjs';import * as control from './mejai-controller.mjs';import {plan,erase} from './gerenciar-conversas.mjs';import {resetPlan,eraseData} from './reset-data.mjs';
const token=randomBytes(32).toString('hex');let port=0,busy=false;const connection=path.join(base,'dados','hub-'+process.platform+'.json');
function open(url){const command=windows?'rundll32.exe':'xdg-open';const args=windows?['url.dll,FileProtocolHandler',url]:[url];const child=spawn(command,args,{windowsHide:true,stdio:'ignore'});child.on('error',()=>console.log('Open this URL: '+url));child.unref();}
try{const previous=JSON.parse(await fs.readFile(connection));const response=await fetch(previous.url+'/api/health',{signal:AbortSignal.timeout(1500)});if(response.ok&&(await response.json()).base===base){if(!process.env.MEJAI_NO_BROWSER)open(previous.url+'/#'+previous.token);process.exit(0);}}catch{}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
 const origin='http://127.0.0.1:'+port;if(req.headers.host!=='127.0.0.1:'+port)throw Error('Invalid host.');if(req.headers.origin&&req.headers.origin!==origin)throw Error('Cross-origin requests are not allowed.');
 if(url.pathname==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({base,platform:process.platform}));return;}
 if(!url.pathname.startsWith('/api/')){const assets={'/':'hub.html','/live-thinking.js':'live-thinking.js','/editor.js':'editor.js','/editor.css':'editor.css','/vendor/marked.js':'../runtime/ui/lib/marked.esm.js','/chat.js':'chat.js','/chat.css':'chat.css','/language.js':'language.js','/hub.js':'hub.js','/hub.css':'hub.css'};const file=assets[url.pathname]||(/^\/(?:chat|hub)\/[a-z-]+\.js$/.test(url.pathname)?url.pathname.slice(1):null);if(!file){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(await fs.readFile(path.join(base,'ui',file)));return;}
 if(req.headers['x-mejai-token']!==token){res.writeHead(403);res.end('Authorization required. Open the hub using its launcher.');return;}
 if(req.method==='POST'&&url.pathname==='/api/chat/upload'){const result=await chat.upload(url.searchParams.get('session'),url.searchParams.get('name'),req);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;}
 if(req.method==='GET'&&url.pathname==='/api/activity/stream'){await control.streamActivity(url.searchParams.get('session'),res);return;}
 let payload={};if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2e6)throw Error('Request too large.');}payload=raw?JSON.parse(raw):{};}else if(req.method!=='GET')throw Error('Unsupported method.');
 const mutation=req.method==='POST'&&url.pathname!=='/api/warmup';if(mutation&&busy)throw Error('Another maintenance operation is running.');if(mutation){busy=true;await control.pauseDiscovery();}
 let result;try{
 switch(req.method+' '+url.pathname){
 case 'GET /api/languages':result=await scanLanguages(base);break;
 case 'POST /api/chat/edit':result=await chat.edit(payload);break;
 case 'POST /api/chat/delete':result=await chat.remove(payload);break;
  case 'GET /api/chat/snapshot':result=await chat.snapshot(url.searchParams.get('session'),url.searchParams.get('recent')==='1');break;
  case 'POST /api/chat/send':result=await chat.send(payload);break;
  case 'POST /api/chat/stop':result=await chat.abort(payload);break;
  case 'POST /api/chat/respond':result=await chat.respond(payload);break;
  case 'GET /api/activity':result=await control.activity(url.searchParams.get('session'));break;
  case 'POST /api/autonomy/start':result=await control.enableAutonomy(payload);break;
  case 'POST /api/autonomy/pause':result=await control.pauseAutonomy(payload);break;
  case 'GET /api/providers':result=await control.providers();break;
  case 'POST /api/providers/select':result=await control.chooseProvider(payload);break;
  case 'POST /api/colibri/config':result=await control.saveColibri(payload);break;
  case 'POST /api/colibri/start':result=await control.startColibri();break;
  case 'POST /api/colibri/stop':result=await control.stopColibri();break;
  case 'GET /api/colibri/logs':result=await control.colibriLogs();break;
  case 'POST /api/warmup':result=busy?{scheduled:false}:await control.warmup();break;
  case 'GET /api/status':result=await control.state();break;
  case 'GET /api/config':result=await control.readConfig(url.searchParams.get('name'));break;
  case 'POST /api/config':result=await control.saveConfig(payload);break;
  case 'POST /api/start':result=await control.start();break;
  case 'POST /api/chat':result=await control.newConversation();break;
  case 'POST /api/stop':result=await control.stop();break;
  case 'POST /api/folder':result=await control.openLocal(payload.name);break;
  case 'POST /api/sessions/open':result=await control.reopenConversation(payload);break;
  case 'GET /api/sessions':result=plan(base);break;
  case 'POST /api/sessions/delete':if(payload.confirm!=='DELETE'||!Array.isArray(payload.ids)||!payload.ids.length)throw Error('Confirm the selected conversations.');await control.stop();await control.idleRequired();result=erase(base,payload.ids);break;
  case 'GET /api/reset':{const p=await resetPlan(base);result={files:p.files,bytes:p.bytes};break;}
  case 'POST /api/reset':if(payload.confirm!=='RESET')throw Error('Type RESET to confirm.');await control.stop();await control.idleRequired();result=await eraseData(base);await saveConnection();break;
  case 'GET /api/diagnostics':result=await control.diagnostics();break;
  case 'GET /api/code/versions':result=await versions();break;
  case 'POST /api/code/snapshot':result=await snapshot();break;
  case 'POST /api/code/restore':if(payload.confirm!=='RESTORE')throw Error('Confirm restoring code.');result=await restore(payload.id);break;
  case 'GET /api/catalog':result=JSON.parse(await fs.readFile(path.join(base,'mcp-catalogo.json'),'utf8'));break;
  case 'POST /api/connect':{const catalog=JSON.parse(await fs.readFile(path.join(base,'mcp-catalogo.json'),'utf8'));if(!catalog[payload.id]?.oauth)throw Error('Choose an OAuth service from the catalog.');result=await control.run(bin.node,[path.join(base,'conectar-mcp.mjs'),payload.id],{cwd:base,windowsHide:true,timeout:310000,maxBuffer:50000});break;}
  case 'GET /api/release':result=await control.releaseInfo();break;
  case 'POST /api/update':if(payload.confirm!=='UPDATE')throw Error('Confirm the update.');result=await control.update();break;
  case 'POST /api/rollback':if(payload.confirm!=='RESTORE')throw Error('Confirm restoring the executable.');result=await control.update(true);break;
  case 'POST /api/tests':result=await control.run(bin.node,[path.join(base,'testes/executar.mjs')],{cwd:base,windowsHide:true,timeout:900000,maxBuffer:200000});break;
  default:throw Error('Unknown action.');
 }
 }finally{if(mutation){busy=false;control.resumeDiscovery();}}
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result??{ok:true}));
}catch(error){res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error.message}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));port=server.address().port;
async function saveConnection(){await fs.mkdir(path.dirname(connection),{recursive:true});await fs.writeFile(connection,JSON.stringify({url:'http://127.0.0.1:'+port,token,pid:process.pid}));}
await saveConnection();control.resumeMonitor().catch(e=>console.error('Model monitor: '+e.message));const address='http://127.0.0.1:'+port+'/#'+token;console.log('MEJAI hub: '+address);if(!process.env.MEJAI_NO_BROWSER)open(address);
