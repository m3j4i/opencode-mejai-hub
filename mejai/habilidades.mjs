import {pathToFileURL} from 'node:url';
import {runtime,bin,windows} from './platform.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {Client}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')));
const {StdioClientTransport}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')));
const {StreamableHTTPClientTransport}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js')));
const {Server}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js')));
const {StdioServerTransport}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js')));
const {ListToolsRequestSchema,CallToolRequestSchema}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js')));
import {builtinTools,runBuiltin} from './habilidades-locais.mjs';
import {localTransport} from './mcp-transport.mjs';
import {readyTor,stopTor} from './tor-local.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(runtime('essenciais/package.json'));
const Ajv=require('ajv');const ajv=new Ajv({strict:false,allowUnionTypes:true});
const catalog=JSON.parse(await fs.readFile(path.join(base,'mcp-catalogo.json'),'utf8'));
const clients=new Map(),pending=new Map();
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const json=value=>({content:[{type:'text',text:JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v)}]});
async function secrets(){try{return JSON.parse(await fs.readFile(path.join(base,'dados/conexoes.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw Error('Fix dados/conexoes.json: invalid JSON.');}}
async function connect(id){
 if(clients.has(id))return clients.get(id);
 if(pending.has(id))return pending.get(id);
 const job=(async()=>{
  const s=catalog[id];if(!s)throw Error('Unknown server. Use search.');if(s.unavailable)throw Error(s.unavailable);
  if(s.alias)return connect(s.alias);
  const keys=await secrets();if(s.builtin)return {tools:builtinTools(id),keys};
  if(s.oauth&&!keys[id.toUpperCase().replaceAll('-','_')+'_CONNECTED'])throw Error('Connect the account through the hub and authorize '+id+' in the browser.');
  if(s.key&&!keys[s.key]&&!s.anonymousUrl)throw Error('Configure '+s.key+' in dados/conexoes.json. Do not send secrets in chat.');
  if(s.commandKey&&!keys[s.commandKey])throw Error('Configure the executable path for '+s.commandKey+' in dados/conexoes.json; requires 1Password with MCP enabled.');
  let transport;
  if(s.url&&!s.oauth){
   const url=new URL(id==='atlassian'?(keys.ATLASSIAN_URL||s.url):s.url);const headers={};
   if(s.key&&keys[s.key]){if(s.queryKey)url.searchParams.set(s.queryKey,keys[s.key]);else headers[s.header||'Authorization']=s.header?keys[s.key]:'Bearer '+keys[s.key];}
   transport=new StreamableHTTPClientTransport(new URL(s.key&&!keys[s.key]&&s.anonymousUrl?s.anonymousUrl:url.href),{requestInit:{headers}});
  }else{
   transport=await localTransport(id,s,base,keys,{proxy:id==='tor-browser'?await readyTor(base):undefined});
  }
  const c=new Client({name:'agente-local-router',version:'1.0'});
  try{await c.connect(transport,{timeout:45000});const tools=[];let cursor;do{const page=await c.listTools(cursor?{cursor}:{});tools.push(...page.tools);cursor=page.nextCursor;}while(cursor);const result={c,tools,keys};clients.set(id,result);return result;}catch(e){await c.close().catch(()=>{});throw Error(id+': connection failed. Check network, credentials and catalog prerequisites.');}
 })();pending.set(id,job);try{return await job;}finally{pending.delete(id);}
}
const schema=properties=>({type:'object',properties,additionalProperties:false});
const str={type:'string'};
const definitions=[
 {name:'status',description:"List installed servers, prerequisites and current connections without starting every server.",inputSchema:schema({})},
 {name:'search',description:"Discover capabilities by objective. Without server, returns matching adapters; with server, returns actual tools. Use English search keywords for this English catalog. Never invent tool names.",inputSchema:schema({query:str,server:str})},
 {name:'details',description:"Return the complete schema of a discovered tool before calling it.",inputSchema:{...schema({server:str,name:str}),required:['server','name']}},
 {name:'call',description:"Call a discovered server/tool using its documented arguments. Errors are not success. Operations are never automatically repeated by this router.",inputSchema:{...schema({server:str,name:str,arguments:{type:'object',additionalProperties:true}}),required:['server','name','arguments']}}
];
function statusFor(id,s,k){
 if(s.oauth&&!k[id.toUpperCase().replaceAll('-','_')+'_CONNECTED'])return 'OAuth login required';
 if(s.unavailable)return 'unavailable';
 if(id==='postgres'&&!k.POSTGRES_URL||id==='mysql'&&!k.MYSQL_URL)return 'database connection required';
 if(['docker','searxng'].includes(id))return 'adapter installed; external service not verified';
 if(id==='apify'&&!k.APIFY_TOKEN)return 'anonymous discovery available; actor execution requires a token';
 if(s.key&&!k[s.key])return 'credentials required';
 if(s.commandKey&&!k[s.commandKey])return 'external application/configuration required';
 return clients.has(id)?'connected':'installed; connect on demand';
}
const server=new Server({name:'habilidades-portateis',version:'1.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:definitions}));
server.setRequestHandler(CallToolRequestSchema,async request=>{
 try{
  const {name,arguments:a={}}=request.params;
  if(name==='status'){const k=await secrets();return json(Object.entries(catalog).map(([id,s])=>({id,description:s.description,status:statusFor(id,s,k),notice:s.unavailable,source:s.source})));}
  if(name==='search'&&!a.server){const words=normalize(a.query||'').split(/\s+/).filter(Boolean);const all=Object.entries(catalog).map(([id,s])=>({server:id,description:s.description,score:words.filter(w=>normalize(id+' '+s.description).includes(w)).length}));const matches=all.filter(x=>!words.length||x.score);return json((matches.length?matches:all).sort((x,y)=>y.score-x.score).slice(0,12));}
  const p=await connect(a.server);
  if(name==='search'){const words=(a.query||'').toLowerCase().split(/\s+/).filter(Boolean);return json(p.tools.filter(t=>!words.length||words.some(w=>(t.name+' '+t.description).toLowerCase().includes(w))).slice(0,40).map(t=>({name:t.name,description:t.description?.slice(0,220)})));}
  const tool=p.tools.find(t=>t.name===a.name);if(!tool)throw Error('Tool not found. Use search with server.');
  if(name==='details')return json(tool);
  if(name!=='call')throw Error('Unknown router tool.');
  if(catalog[a.server].builtin){const validate=ajv.compile(tool.inputSchema);if(!validate(a.arguments))throw Error('Invalid arguments: '+ajv.errorsText(validate.errors));}
  if(a.server==='aisa'&&['use','batch_use'].includes(a.name)){
   const cap=Number((await secrets()).AISA_MAX_PRICE_USD||0);
   if(!(cap>0))throw Error('Paid AIsa calls are disabled. Configure an AISA_MAX_PRICE_USD spending ceiling first.');
   if(a.name==='batch_use')throw Error('Use individual calls after checking the price through get_details.');
   a.arguments.max_price_usd=Math.min(cap,Number(a.arguments.max_price_usd)||cap);
  }
  if(a.server==='tor'&&a.name==='stop'&&clients.has('tor-browser')){await clients.get('tor-browser').c.close();clients.delete('tor-browser');}
  if(catalog[a.server].builtin)return json(await runBuiltin(a.server,a.name,a.arguments,base,await secrets()));
  const result=await p.c.callTool({name:a.name,arguments:a.arguments},undefined,{timeout:120000});
  // Shadcn 4.21.1 can interpolate an unresolved Promise in search results.
  if(a.server==='shadcn')for(const block of result.content||[])if(block.type==='text')block.text=block.text.replace(/Add command: `\[object Promise\]`/g,'Use get_add_command_for_items to obtain the installation command.');
  return result;
 }catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}
});
async function close(){await Promise.allSettled([...clients.values()].map(x=>x.c.close()));await stopTor();process.exit(0);}
process.on('SIGINT',close);process.on('SIGTERM',close);process.stdin.on('end',close);
await server.connect(new StdioServerTransport());
