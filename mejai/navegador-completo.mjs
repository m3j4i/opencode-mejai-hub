import {searchTorch} from "./src/services/torch-search.mjs";
import {pathToFileURL} from 'node:url';
import {runtime,bin,windows} from './platform.mjs';
import {launchBrowser} from './browser-engine.mjs';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
const {chromium}=await import(pathToFileURL(runtime('browser/node_modules/playwright/index.mjs')));
const {createConnection}=await import(pathToFileURL(runtime('browser/node_modules/@playwright/mcp/index.js')));
const {Client}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')));
const {Server}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js')));
const {StdioServerTransport}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js')));
const {InMemoryTransport}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js')));
const {ListToolsRequestSchema,CallToolRequestSchema}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js')));
import {transferManager} from './transfer-manager.mjs';
import {archiveIntegrity} from './archive-integrity.mjs';
import {usefulLinks} from './browser-links.mjs';
import {searchWeb} from './browser-search.mjs';
import {invalidArtifact} from './plugins/execution-core.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
const settings=JSON.parse(await fs.readFile(path.join(base,'navegador-config.json'),'utf8'));
const downloads=process.env.AGENTE_TEST_DOWNLOADS||process.env.AGENTE_DOWNLOADS||path.join(base,'downloads');
await fs.mkdir(downloads,{recursive:true});
const manifest=path.join(downloads,'downloads.json');
let records=[];try{records=JSON.parse(await fs.readFile(manifest,'utf8'));}catch{}
for(const record of records)if(['recebendo','verificando'].includes(record.status)){record.status='interrompido';record.error='Navegador reiniciado antes de concluir.';}
let queue=Promise.resolve();
function persist(){const value=JSON.stringify(records,null,2);queue=queue.catch(()=>{}).then(()=>fs.writeFile(manifest,value));return queue;}
await persist();
let context,activeURL,launch,backendStale=false;
const handles=new Map();
const tasks=new Set();
const transfers=transferManager({base,directory:downloads,records,persist,tasks,cookies:async url=>context?(await context.cookies(url)).map(c=>c.name+'='+c.value).join('; '):''});
function monitor(page){
 page.on('download',download=>{
  const id=randomUUID();
  const filename=(download.suggestedFilename()||'arquivo').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(-160)||'arquivo';
  const record={id,url:download.url(),filename,path:path.join(downloads,id+'-'+filename),status:'recebendo',started:new Date().toISOString()};
  records.push(record);handles.set(id,download);persist();
  const task=(async()=>{
   try{
    await download.saveAs(record.path);
    const failure=await download.failure();if(failure)throw Error(failure);
    record.status='verificando';record.bytes=(await fs.stat(record.path)).size;await persist();
    if(!record.bytes)throw Error('Empty file.');
    const invalid=invalidArtifact(record.path);if(invalid)throw Error(invalid);
    const hash=createHash('sha256');for await(const part of createReadStream(record.path))hash.update(part);
    record.sha256=hash.digest('hex');record.integrity=await archiveIntegrity(record.path,base);
    if(record.integrity.status==='falhou')throw Error(record.integrity.message);
    record.status=record.integrity.status==='senha_necessaria'?'aguarda_senha':'concluido';
   }catch(e){record.status='falhou';record.error=e.message;}
   finally{record.finished=new Date().toISOString();handles.delete(id);await persist();}
  })();
  tasks.add(task);task.finally(()=>tasks.delete(task));
 });
}
async function getContext(){
 if(context)return context;
 if(launch)return launch;
 launch=(async()=>{
  context=await launchBrowser(base,settings,chromium);
  context.on('close',()=>{context=undefined;activeURL=undefined;backendStale=true;});
  context.on('page',monitor);for(const page of context.pages())monitor(page);
  return context;
 })();
 try{return await launch;}finally{launch=undefined;}
}
async function current(){const ctx=await getContext();return ctx.pages().find(p=>p.url()===activeURL)||ctx.pages().at(-1)||await ctx.newPage();}
async function connectBackend(){
const upstream=await createConnection({capabilities:['core','vision','pdf','devtools'],outputDir:path.join(base,'logs',process.env.AGENTE_BROWSER_PROXY?'navegador-tor':'navegador'),filePaths:'absolute',timeouts:{action:15000,navigation:120000},webmcp:false},getContext);
const [ct,st]=InMemoryTransport.createLinkedPair();
await upstream.connect(st);
const fresh=new Client({name:'agente-local-browser',version:'2.0'});
await fresh.connect(ct);return fresh;
}
let client=await connectBackend();
async function refreshBackend(){if(backendStale){await client.close().catch(()=>{});client=await connectBackend();backendStale=false;}}
const tools=(await client.listTools()).tools;
const pinned=new Set(['browser_navigate','browser_snapshot','browser_click','browser_type','browser_fill_form','browser_press_key','browser_tabs','browser_wait_for','browser_take_screenshot','browser_find','browser_select_option','browser_navigate_back','browser_handle_dialog','browser_close']);
const advanced=tools.filter(t=>!pinned.has(t.name));
const extras=[
 {name:'browser_download_file',description:"Download a real HTTP/HTTPS file in the background using browser cookies. Preserve partial downloads and verify length, signature, SHA-256 and archive integrity. Returns an ID; poll browser_downloads. HTML is not a downloaded artifact.",inputSchema:{type:'object',properties:{url:{type:'string'},filename:{type:'string'}},required:['url'],additionalProperties:false}},
 {name:'browser_resume_download',description:"Resume a download ID only after validating HTTP 206, Content-Range and file identity. Preserve partial data if a safe resume is unavailable.",inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}},
 {name:'browser_verify_file',description:"Verify a local file without executing or extracting it: signature, SHA-256 and complete archive integrity. Returns an ID; poll browser_downloads. Supply a password when needed. Waiting for a password is not successful verification.",inputSchema:{type:'object',properties:{path:{type:'string'},password:{type:'string'}},required:['path'],additionalProperties:false}},
 {name:'browser_search',description:process.env.AGENTE_BROWSER_PROXY?"Search onion services with Torch through Tor. Supply query and optional limit. Auto also selects Torch. Preserve the page and report failures; no alternate engine or direct fallback.":"Search through the browser without an API key. In the Tor profile, auto always uses Torch and never falls back to clearnet or another engine. Return observed links. Auto tries Bing and DuckDuckGo once each. Report challenges and preserve the page for optional human assistance; never claim CAPTCHA bypass.",inputSchema:{type:'object',properties:{query:{type:'string',minLength:1,maxLength:1000},engine:{type:'string',enum:process.env.AGENTE_BROWSER_PROXY?['auto','torch']:['auto','bing','duckduckgo','torch']},limit:{type:'integer',minimum:1,maximum:20}},required:['query'],additionalProperties:false}},
 {name:'browser_tool_search',description:"Discover advanced browser tools, including screenshots, visual coordinates, network, JavaScript and PDF. Use the actual returned name and schema with browser_tool_call.",inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}},
 {name:'browser_tool_call',description:"Call an advanced tool discovered with browser_tool_search using its exact name and arguments.",inputSchema:{type:'object',properties:{name:{type:'string'},arguments:{type:'object',additionalProperties:true}},required:['name','arguments'],additionalProperties:false}},
 {name:'browser_links',description:"List real absolute links from the current page and frames. Filter by title or URL and paginate with offset.",inputSchema:{type:'object',properties:{filter:{type:'string'},limit:{type:'integer',minimum:1,maximum:200},offset:{type:'integer',minimum:0}},additionalProperties:false}},
 {name:'browser_download',description:"Start downloading an observed or user-provided URL with the current browser cookies. For large direct files prefer browser_download_file. Button-triggered downloads are also tracked. Poll browser_downloads.",inputSchema:{type:'object',properties:{url:{type:'string'}},required:['url'],additionalProperties:false}},
 {name:'browser_downloads',description:"Check download state, path, bytes, hash and integrity. Do not claim completion while receiving, verifying, failed or waiting for a password.",inputSchema:{type:'object',properties:{id:{type:'string'}},additionalProperties:false}},
 {name:'browser_cancel_download',description:"Cancel an active download by its recorded ID.",inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}},
];
const server=new Server({name:'agente-local-navegador-completo',version:'2.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[...tools.filter(t=>pinned.has(t.name)),...extras]}));
const text=value=>({content:[{type:'text',text:typeof value==='string'?value:JSON.stringify(value,null,2)}]});
server.setRequestHandler(CallToolRequestSchema,async request=>{
 let {name,arguments:args={}}=request.params;
 const beforeDownloads=records.length;
 try{
  if(name==='browser_download_file'){if(process.env.AGENTE_BROWSER_PROXY)name='browser_download';else return text(await transfers.start(args.url,args.filename));}
  if(name==='browser_resume_download')return text(transfers.resume(args.id));
  if(name==='browser_verify_file'){
   const file=path.resolve(args.path),stat=await fs.stat(file);if(!stat.isFile())throw Error('Provide a local file.');
   const record={id:randomUUID(),path:file,filename:path.basename(file),status:'verificando',bytes:stat.size,started:new Date().toISOString(),kind:'verificacao'};records.push(record);await persist();
   const task=(async()=>{try{const bad=invalidArtifact(file);if(bad)throw Error(bad);const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);record.sha256=hash.digest('hex');record.integrity=await archiveIntegrity(file,base,args.password);if(record.integrity.status==='falhou')throw Error(record.integrity.message);record.status=record.integrity.status==='senha_necessaria'?'aguarda_senha':'concluido';}catch(e){record.status='falhou';record.error=e.message;}finally{record.finished=new Date().toISOString();await persist();}})();tasks.add(task);task.finally(()=>tasks.delete(task));return text(record);
  }
  if(name==='browser_search'){
   const proxied=!!process.env.AGENTE_BROWSER_PROXY;if(args.engine==='torch'&&!proxied)throw Error('Torch searches require tor-browser.');const config=proxied?JSON.parse(await fs.readFile(path.join(base,'tor-search.json'),'utf8')):null;const result=proxied?await searchTorch(await getContext(),args,config,process.env.AGENTE_BROWSER_PROXY):await searchWeb(await getContext(),args);activeURL=result.page;return text(result);
  }
  if(name==='browser_tool_search'){
   const synonyms={rede:'network request',visual:'vision screenshot mouse',tela:'screenshot',codigo:'evaluate javascript code',clique:'click mouse',avaliar:'evaluate javascript',imprimir:'pdf',console:'console',download:'network'};
   const terms=String(args.query||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\W+/).filter(Boolean).flatMap(w=>[w,...(synonyms[w]||'').split(' ').filter(Boolean)]);
   return text(advanced.map(t=>({t,score:terms.filter(w=>(t.name+' '+t.description).toLowerCase().includes(w)).length})).filter(x=>x.score).sort((a,b)=>b.score-a.score).slice(0,4).map(x=>x.t));
  }
  if(name==='browser_tool_call'){
   if(!advanced.some(t=>t.name===args.name))throw Error('Advanced tool not found. Use browser_tool_search.');
   name=args.name;args=args.arguments||{};
  }
  if(name==='browser_links'){
   const page=await current();const filter=String(args.filter||'').toLowerCase();const found=[];
   for(const frame of page.frames()){
    try{const links=await frame.locator('a[href]').evaluateAll(anchors=>anchors.map(a=>({text:(a.textContent?.trim()||a.getAttribute('aria-label')||a.getAttribute('title')||a.querySelector('img')?.alt||'').trim().slice(0,180),url:a.href})));
     for(const link of links)if(/^https?:\/\//i.test(link.url)&&(!filter||(link.text+' '+link.url).toLowerCase().includes(filter)))found.push({...link,page:frame.url()});
    }catch{}
   }
   const cleaned=usefulLinks(found,filter),offset=Math.max(0,Math.trunc(args.offset||0)),limit=Math.min(200,Math.max(1,args.limit||60));
   return text({page:page.url(),total:cleaned.length,offset,nextOffset:offset+limit<cleaned.length?offset+limit:null,links:cleaned.slice(offset,offset+limit),hint:'Use the exact returned URL. For a direct href, prefer browser_navigate over clicking through overlapping advertisements.'});
  }
  if(name==='browser_downloads'){
   const selected=args.id?records.filter(r=>r.id===args.id):records.slice(-30);
   return text({downloads:selected,directory:downloads});
  }
  if(name==='browser_cancel_download'){
   if(transfers.cancel(args.id))return text('Cancellation requested; partial download preserved.');
   const download=handles.get(args.id);if(!download)throw Error('ID does not match an active download.');await download.cancel();return text('Cancellation requested. Check browser_downloads.');
  }
  if(name==='browser_download'){
   if(!/^https?:\/\//i.test(args.url||''))throw Error('Provide a real HTTP/HTTPS URL.');
   const ctx=await getContext();const page=await ctx.newPage();
   const wait=page.waitForEvent('download',{timeout:20000}).catch(()=>null);
   try{await page.goto(args.url,{waitUntil:'domcontentloaded',timeout:18000});}catch(e){if(!/download|ERR_ABORTED/i.test(e.message)){await page.close();throw e;}}
   const download=await wait;
   if(!download){activeURL=page.url();return text({status:'nao_iniciado',page:page.url(),message:'The site opened a page instead of providing the file. Inspect the snapshot, login, download button or challenge; do not claim success.'});}
   const record=records.findLast(r=>handles.get(r.id)===download||r.url===download.url());
   return text(record||{status:'recebendo',url:download.url()});
  }
  if(name==='browser_close'){
   if(handles.size||transfers.busy())throw Error('Downloads are active. Wait or cancel by ID.');
   await context?.close();context=undefined;activeURL=undefined;backendStale=true;
   return text('Browser closed. The next navigation starts a new connection.');
  }
  if(!tools.some(t=>t.name===name))throw Error('Unknown tool.');
  if(name==='browser_close'&&(handles.size||transfers.busy()))throw Error('Downloads are active. Check browser_downloads or cancel by ID before closing the browser.');
  await refreshBackend();
  const result=await client.callTool({name,arguments:args},undefined,{timeout:125000});
  const output=result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n')||'';
  const pageURL=output.match(/^- Page URL: (.+)$/m)?.[1];if(pageURL)activeURL=pageURL.trim();
  if(/Ref .* not found|Execution context was destroyed/i.test(output)){
   const fresh=await client.callTool({name:'browser_snapshot',arguments:{}},undefined,{timeout:30000});
   result.content.push({type:'text',text:'The page changed. An updated snapshot follows; choose the NEW reference. The previous action was not automatically repeated.'},...fresh.content);
   const newURL=fresh.content.filter(c=>c.type==='text').map(c=>c.text).join('\n').match(/^- Page URL: (.+)$/m)?.[1];if(newURL)activeURL=newURL.trim();
  }
  if(records.length>beforeDownloads)result.content.push({type:'text',text:'Downloads detectados: '+JSON.stringify(records.slice(beforeDownloads))+'. Confirme o estado com browser_downloads.'});
  const pending=records.filter(r=>['recebendo','verificando'].includes(r.status));
  if(pending.length)result.content.push({type:'text',text:'Downloads ativos: '+pending.map(r=>r.id).join(', ')+'. Use browser_downloads para verificar conclusao.'});
  return result;
 }catch(e){return {...text(e.message),isError:true};}
});
await server.connect(new StdioServerTransport());
let closing=false;
async function close(){if(closing)return;closing=true;transfers.stop();await context?.close().catch(()=>{});await Promise.allSettled([...tasks]);await queue;await client.close();await server.close();process.exit(0);}
process.stdin.on('end',close);process.on('SIGTERM',close);process.on('SIGINT',close);
