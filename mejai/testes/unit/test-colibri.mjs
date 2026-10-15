import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {providerFrom,validateSettings,emptyProvider,sync as colibriSync} from '../../colibri-provider.mjs';
import {sync as ollamaSync} from '../../sincronizar-modelos.mjs';
const base=await fs.mkdtemp(path.join(os.tmpdir(),'mejai-colibri-'));
const configFile=path.join(base,'opencode.json');
let busy=false,failDispose=false,disposals=0;
const server=http.createServer((req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.url==='/session/status')return res.end(JSON.stringify(busy?{one:{type:'busy'}}:{}));
 if(req.url==='/global/dispose'){disposals++;if(failDispose)res.statusCode=503;return res.end('{}');}
 if(req.url==='/api/tags')return res.end(JSON.stringify({models:[{name:'local:latest',digest:'test'}]}));
 if(req.url==='/api/show')return res.end(JSON.stringify({capabilities:['completion','tools'],parameters:'num_ctx 8192'}));
 res.statusCode=404;res.end('{}');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const api='http://127.0.0.1:'+server.address().port;
try{
 const modelSettings={modelDirectory:'models/colibri/example',backend:'cpu',context:16384,output:4096,tools:true};
 assert.throws(()=>validateSettings({...modelSettings,modelDirectory:'../outside'}));
 assert.throws(()=>validateSettings({...modelSettings,modelDirectory:'C:/outside'}));
 assert.throws(()=>validateSettings({...modelSettings,output:16384}));
 const provider=providerFrom([{id:'qwen-test',capabilities:['chat','systemone'],input_modalities:['text']}],modelSettings,api+'/v1');
 assert.equal(provider.models['qwen-test'].tool_call,true);
 assert.deepEqual(provider.models['qwen-test'].limit,{context:16384,output:4096});
 assert.equal(providerFrom([{id:'unknown',capabilities:['chat']}],{...modelSettings,tools:false},api+'/v1').models.unknown.tool_call,false);
 assert.throws(()=>providerFrom([{id:'picture',capabilities:['image_generation']}],modelSettings,api+'/v1'));
 const config={model:'colibri/qwen-test',small_model:'colibri/qwen-test',enabled_providers:['ollama','colibri'],provider:{ollama:{options:{baseURL:api+'/v1'},models:{}},colibri:emptyProvider()},instructions:['keep.md'],permission:{task:'deny'}};
 await fs.writeFile(configFile,JSON.stringify(config));
 await ollamaSync({base,configFile,endpoint:api,initial:true});
 let saved=JSON.parse(await fs.readFile(configFile));
 assert.equal(saved.model,'colibri/qwen-test');assert.equal(saved.small_model,'colibri/qwen-test');
 const before=await fs.readFile(configFile,'utf8');busy=true;
 assert.equal((await colibriSync({configFile,api,provider})).pending,true);assert.equal(await fs.readFile(configFile,'utf8'),before);assert.equal(disposals,0);
 busy=false;failDispose=true;await assert.rejects(colibriSync({configFile,api,provider}),/503/);assert.equal(await fs.readFile(configFile,'utf8'),before);
 failDispose=false;await colibriSync({configFile,api,provider});saved=JSON.parse(await fs.readFile(configFile));
 assert.deepEqual(saved.provider.colibri,provider);assert.equal(saved.model,config.model);assert.deepEqual(saved.instructions,config.instructions);assert.deepEqual(saved.permission,config.permission);
 const selected=await fs.readFile(configFile,'utf8');assert.equal((await colibriSync({configFile,api,provider:null})).changed,false);assert.equal(await fs.readFile(configFile,'utf8'),selected);
 assert.equal((await colibriSync({configFile,api,provider})).changed,false);
 console.log('PASS Colibri discovery, context/tools metadata, manual selection preserved, busy deferral, offline preservation, failed reload rollback, model path validation. No real model prompts.');
}finally{await new Promise(r=>server.close(r));await fs.rm(base,{recursive:true,force:true});}
