import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const base=process.env.AGENTE_LOCAL_HOME,root=await fs.mkdtemp(path.join(os.tmpdir(),'mejai-autonomy-events-'));await fs.mkdir(path.join(root,'plugins'));await fs.mkdir(path.join(root,'dados/autonomy'),{recursive:true});
for(const f of ['autonomy.mjs','autonomy-core.mjs','long-session-core.mjs'])await fs.copyFile(path.join(base,'plugins',f),path.join(root,'plugins',f));
const {default:plugin}=await import(pathToFileURL(path.join(root,'plugins/autonomy.mjs')));const id='ses_fixture',file=path.join(root,'dados/autonomy',id+'.json');process.env.MEJAI_RUN_ID='fixture-run';
const initial={sessionID:id,enabled:true,runID:'fixture-run',generation:'one',started:Date.now(),minutes:10,maxTurns:10,turns:0};
let calls=0,mode='',reads=0;const messages=[{info:{role:'user'},parts:[]},{info:{id:'msg_fixture',role:'assistant',time:{completed:Date.now()},providerID:'ollama',modelID:'fake'},parts:[{type:'text',text:'I will continue.'}]}];
const client={session:{status:async()=>({data:{}}),messages:async()=>{reads++;if(mode==='race'&&reads===2)await fs.writeFile(file,JSON.stringify({...initial,enabled:false,generation:'two'}));return {data:messages};},todo:async()=>({data:[{content:'Finish',status:'pending'}]}),promptAsync:async()=>{calls++;return {data:undefined};}}};
for(const kind of ['continue','question','permission','error','restart','race']){
 await fs.writeFile(file,JSON.stringify({...initial,runID:kind==='restart'?'old-run':'fixture-run'}));mode=kind;reads=0;const before=calls,h=await plugin({client});
 await h.event({event:{type:'session.idle',properties:{sessionID:id}}});
 if(['question','permission','error'].includes(kind))await h.event({event:{type:kind==='error'?'session.error':kind+'.asked',properties:{sessionID:id}}});
 await new Promise(r=>setTimeout(r,1450));assert.equal(calls-before,kind==='continue'?1:0,kind);
 if(kind==='continue'){await h.event({event:{type:'session.idle',properties:{sessionID:id}}});await new Promise(r=>setTimeout(r,1450));assert.equal(calls-before,1,'no duplicate continuation');}
 await h.dispose();
}
console.log('PASS autonomy events: 204-like success, deduplication, question/permission/error pause, restart isolation and concurrent manual pause.');await fs.rm(root,{recursive:true,force:true});
