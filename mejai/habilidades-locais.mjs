import {runtime,bin,windows} from './platform.mjs';
import {ocrTools,runOCR} from './habilidades-ocr.mjs';
import {documentTools,runDocument} from './habilidades-documentos.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {extraTools,runExtra} from './habilidades-extras.mjs';
const require=createRequire(runtime('essenciais/package.json'));
const S={type:'string'}, A={type:'array',items:{type:['string','number','boolean','null']}};
const tool=(name,description,properties,required=[])=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false}});
export function builtinTools(id){if(id==='ocr')return ocrTools;if(id==='documentos')return documentTools;if(['tor','obsidian'].includes(id))return extraTools(id);return ({
 'ast-grep':[tool('find','Search supplied source code with official ast-grep. Return positions and snippets without modifying files.',{code:S,pattern:S,language:{type:'string',enum:['JavaScript','TypeScript','Tsx','Html','Css']}},['code','pattern','language'])],
 fetch:[tool('fetch','Extract a public HTTP page into readable text. For dynamic pages, login or downloads use server navegador.',{url:S,max_chars:{type:'integer',minimum:100,maximum:50000}},['url'])],
 sqlite:[tool('query','Query local SQLite with parameterized SQL. Relative paths resolve inside the kit. Writes require write=true.',{database:S,sql:S,parameters:A,write:{type:'boolean'}},['sql'])],
 postgres:[tool('query','Parameterized PostgreSQL, read-only by default. Set POSTGRES_URL in dados/conexoes.json.',{sql:S,parameters:A,write:{type:'boolean'}},['sql'])],
 mysql:[tool('query','Parameterized MySQL, read-only by default. Set MYSQL_URL in dados/conexoes.json.',{sql:S,parameters:A,write:{type:'boolean'}},['sql'])],
 searxng:[tool('search','Search the configured SearXNG instance. Requires a running external SearXNG service.',{query:S,language:S},['query'])],
 docker:[tool('containers','List containers from the local Docker engine. Does not install Docker.',{}),tool('logs','Read recent container log lines.',{id:S,tail:{type:'integer',minimum:1,maximum:1000}},['id']),tool('inspect','Inspect a container.',{id:S},['id']),tool('start','Start an existing container.',{id:S},['id']),tool('stop','Stop an existing container.',{id:S},['id'])]
})[id]||[];}
function dockerRequest(keys,route,method='GET'){
 return new Promise((resolve,reject)=>{const req=http.request({socketPath:keys.DOCKER_PIPE||(windows?'//./pipe/docker_engine':'/var/run/docker.sock'),path:route,method,timeout:15000},r=>{let data='';r.on('data',b=>{data+=b;if(data.length>2e6)req.destroy(Error('Docker response exceeded 2 MB. Narrow the request.'));});r.on('end',()=>{if(r.statusCode>=400)return reject(Error('Docker HTTP '+r.statusCode));try{resolve(JSON.parse(data));}catch{resolve(data);}});});req.on('timeout',()=>req.destroy(Error('Docker engine did not respond.')));req.on('error',()=>reject(Error('Docker engine unavailable. A running external Docker service is required.')));req.end();});
}
export async function runBuiltin(id,name,a,base,keys){
 if(id==='ocr')return runOCR(name,a,base);
 if(id==='documentos')return runDocument(name,a,base);
 if(['tor','obsidian'].includes(id))return runExtra(id,name,a,base,keys);
 if(!builtinTools(id).some(t=>t.name===name))throw Error('Unknown tool.');
 if(id==='ast-grep'){
  const ast=require('@ast-grep/napi');if(!['JavaScript','TypeScript','Tsx','Html','Css'].includes(a.language))throw Error('Language is not included in this adapter.');
  if(typeof a.code!=='string'||a.code.length>2e6)throw Error('Provide at most 2 MB of code.');
  return ast.parse(ast.Lang[a.language],a.code).root().findAll(a.pattern).slice(0,200).map(n=>({text:n.text(),range:n.range()}));
 }
 if(id==='fetch'){
  const url=new URL(a.url);if(!['http:','https:'].includes(url.protocol))throw Error('Use HTTP/HTTPS.');
  const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'AgenteLocal/1.0'}});if(!r.ok)throw Error('HTTP '+r.status+': use the browser or another discovered source.');
  const chunks=[];let size=0;for await(const b of r.body){size+=b.length;if(size>4e6)throw Error('Page exceeded 4 MB; use the browser.');chunks.push(b);}const raw=Buffer.concat(chunks).toString('utf8');
  if(!/text|json|xml|html/.test(r.headers.get('content-type')||''))throw Error('Binary content: use browser_download.');
  let text=raw,title='',links=[];
  if(/html/.test(r.headers.get('content-type')||'')){
   const {parseHTML}=require('linkedom');const {Readability}=require('@mozilla/readability');const {document}=parseHTML(raw);
   links=[...document.querySelectorAll('a[href]')].slice(0,150).flatMap(x=>{try{const u=new URL(x.getAttribute('href'),r.url);return /^https?:$/.test(u.protocol)?[{text:x.textContent.slice(0,160),url:u.href}]:[];}catch{return [];}});
   document.querySelectorAll('script,style,noscript').forEach(n=>n.remove());const article=new Readability(document).parse();text=article?.textContent||document.body.textContent;title=article?.title||document.title;
  }
  const max=Math.max(100,Math.min(50000,Number(a.max_chars)||15000));return {url:r.url,title,text:text.slice(0,max),truncated:text.length>max,links};
 }
 if(id==='sqlite'){
  const file=path.resolve(base,a.database||'dados/agente.sqlite');await fs.mkdir(path.dirname(file),{recursive:true});
  const db=new DatabaseSync(file);try{db.exec('PRAGMA busy_timeout=5000');if(!a.write)db.exec('PRAGMA query_only=ON');const st=db.prepare(a.sql);const cols=st.columns();if(cols.length){const rows=[];for(const row of st.iterate(...(a.parameters||[]))){rows.push(row);if(rows.length>=1000)break;}return {rows,limit:1000};}return st.run(...(a.parameters||[]));}finally{db.close();}
 }
 if(id==='postgres'){
  if(!keys.POSTGRES_URL)throw Error('Configure POSTGRES_URL in dados/conexoes.json.');const {Client}=require('pg');const c=new Client({connectionString:keys.POSTGRES_URL,connectionTimeoutMillis:10000,statement_timeout:20000});
  try{await c.connect();await c.query(a.write?'BEGIN':'BEGIN READ ONLY');const r=await c.query(a.sql,a.parameters||[]);await c.query('COMMIT');return {rows:r.rows.slice(0,1000),rowCount:r.rowCount};}catch(e){await c.query('ROLLBACK').catch(()=>{});throw Error('PostgreSQL query failed: '+(e.code||'connection/SQL'));}finally{await c.end().catch(()=>{});}
 }
 if(id==='mysql'){
  if(!keys.MYSQL_URL)throw Error('Configure MYSQL_URL in dados/conexoes.json.');const mysql=require('mysql2/promise');let c;
  try{c=await mysql.createConnection(keys.MYSQL_URL);await c.query(a.write?'START TRANSACTION':'START TRANSACTION READ ONLY');const [rows]=await c.execute({sql:a.sql,timeout:20000},a.parameters||[]);await c.commit();return Array.isArray(rows)?{rows:rows.slice(0,1000),limit:1000}:rows;}catch(e){await c?.rollback().catch(()=>{});throw Error('MySQL query failed: '+(e.code||'connection/SQL'));}finally{await c?.end();}
 }
 if(id==='searxng'){
  const url=new URL('/search',keys.SEARXNG_URL||'http://127.0.0.1:8088');url.searchParams.set('q',a.query);url.searchParams.set('format','json');url.searchParams.set('language',a.language||'all');
  const r=await fetch(url,{signal:AbortSignal.timeout(20000)}).catch(()=>{throw Error('SearXNG unavailable. Check the external SearXNG service; use Exa meanwhile.');});if(!r.ok)throw Error('SearXNG HTTP '+r.status+'. Enable JSON responses on the server.');const data=await r.json();return {results:data.results?.slice(0,15),unresponsive_engines:data.unresponsive_engines};
 }
 if(id==='docker'){
  if(name==='containers')return dockerRequest(keys,'/containers/json?all=1');if(!/^[a-zA-Z0-9_.-]+$/.test(a.id))throw Error('Invalid container ID.');
  const root='/containers/'+encodeURIComponent(a.id);
  if(name==='logs')return dockerRequest(keys,root+'/logs?stdout=1&stderr=1&tail='+Math.min(1000,Math.max(1,a.tail||100)));
  if(name==='inspect')return dockerRequest(keys,root+'/json');return dockerRequest(keys,root+'/'+name,'POST');
 }
 throw Error('Unknown server.');
}

