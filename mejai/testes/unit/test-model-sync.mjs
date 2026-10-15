import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {sync,modelEntry} from '../../sincronizar-modelos.mjs';
const base=await fs.mkdtemp(path.resolve('work/sync-test-'));
let names=['primeiro:latest'],busy=false,disposals=0,fail=false;
const server=http.createServer((req,res)=>{
 res.setHeader('content-type','application/json');
 if(fail&&req.url.startsWith('/api/')){res.writeHead(503);res.end('{}');return;}
 if(req.url==='/api/tags')res.end(JSON.stringify({models:names.map(name=>({name,digest:name}))}));
 else if(req.url==='/api/show')res.end(JSON.stringify({capabilities:['completion','tools'],parameters:'num_ctx 8192'}));
 else if(req.url==='/session/status')res.end(JSON.stringify(busy?{one:{type:'busy'}}:{}));
 else if(req.url==='/global/dispose'){disposals++;res.end('true');}
 else{res.writeHead(404);res.end('{}');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const endpoint='http://127.0.0.1:'+server.address().port;
const file=path.join(base,'opencode.json');
const config={model:'ollama/primeiro:latest',small_model:'ollama/primeiro:latest',provider:{ollama:{options:{},models:{}}},plugin:['protecoes.mjs'],instructions:['comum.md'],mcp:{extra:{enabled:true}}};
await fs.writeFile(file,JSON.stringify(config));
const options={base,endpoint,api:endpoint};
try{
 await sync({...options,initial:true});
 names.push('novo:latest');busy=true;
 assert.equal((await sync(options)).pending,true);
 assert.equal(disposals,0);
 busy=false;await sync(options);
 let saved=JSON.parse(await fs.readFile(file));
 assert(saved.provider.ollama.models['novo:latest']);
 assert.equal(saved.model,'ollama/primeiro:latest');
 assert.deepEqual(saved.plugin,config.plugin);assert.deepEqual(saved.mcp,config.mcp);
 assert.equal((await sync(options)).changed,false);assert.equal(disposals,1);
 names=['novo:latest'];await sync(options);
 saved=JSON.parse(await fs.readFile(file));
 assert(!saved.provider.ollama.models['primeiro:latest']);assert.equal(saved.model,'ollama/novo:latest');
 const before=await fs.readFile(file,'utf8');
 names=[];await assert.rejects(sync(options),/No chat model/);assert.equal(await fs.readFile(file,'utf8'),before);
 fail=true;await assert.rejects(sync(options),/HTTP 503/);assert.equal(await fs.readFile(file,'utf8'),before);
 assert.equal(modelEntry({name:'embedding'},{capabilities:['embedding']}),null);
 assert.equal(modelEntry({name:'chat'},{capabilities:['completion']}).tool_call,false);
 console.log('PASS: descoberta, adicao/remocao, preferencia preservada, regras/MCPs preservados, adiamento durante tarefas, falha/ausencia de Ollama sem apagar modelos, embeddings excluidos.');
}finally{server.close();}

