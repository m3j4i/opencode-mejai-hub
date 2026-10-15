import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const base=process.env.AGENTE_LOCAL_HOME;
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'mejai-ledger-'));await fs.mkdir(path.join(fixture,'plugins'));
for(const file of ['long-session-core.mjs','autonomy-core.mjs','tor-search-policy.mjs','code-delivery-policy.mjs','assurance.mjs','content-completeness.mjs','execution-core.mjs','portable-shell.mjs'])await fs.copyFile(path.join(base,'plugins',file),path.join(fixture,'plugins',file));
const {default:assurance}=await import(pathToFileURL(path.join(fixture,'plugins/assurance.mjs')));
const hooks=await assurance({directory:fixture}),id='ses_fixture';
const file=path.join(fixture,'result.txt');await fs.writeFile(file,'Resultado...');
const messages=[{info:{id:'msg1',sessionID:id,role:'user'},parts:[{type:'text',text:'Faça um arquivo'}]}];
await hooks['experimental.chat.messages.transform']({}, {messages});
await hooks['tool.execute.after']({sessionID:id,tool:'write',args:{filePath:file}},{output:'saved',metadata:{}});
let state=JSON.parse(await fs.readFile(path.join(fixture,'dados/progresso',id+'.json')));assert.equal(state.artifacts[file].needsReview,true);assert.equal(state.artifacts[file].functional,'not_verified');
const restarted=await assurance({directory:fixture});await restarted['experimental.chat.messages.transform']({}, {messages});assert.match(messages[0].parts.at(-1).text,/result.txt/);
await hooks.event({event:{type:'permission.asked',properties:{sessionID:id}}});state=JSON.parse(await fs.readFile(path.join(fixture,'dados/progresso/atual.json')));assert.match(state.state,/waiting/);
await hooks.event({event:{type:'session.deleted',properties:{sessionID:id}}});await assert.rejects(fs.access(path.join(fixture,'dados/progresso',id+'.json')));
const {default:retry}=await import(pathToFileURL(path.join(base,'plugins/http-retry.mjs')));
const history=[{parts:[1,2].map(()=>({type:'tool',tool:'webfetch',state:{input:{url:'https://example.com/missing'},error:'HTTP 404'}}))}];
const guard=await retry({client:{session:{messages:async()=>({data:history})}}});
await assert.rejects(guard['tool.execute.before']({sessionID:id,tool:'webfetch'},{args:{url:'https://example.com/missing'}}),/FONTE_REPETIDAMENTE/);
await guard['tool.execute.before']({sessionID:id,tool:'webfetch'},{args:{url:'https://example.com/other'}});
const catalog=JSON.parse(await fs.readFile(path.join(base,'mcp-catalogo.json'),'utf8'));assert.equal(catalog.navegador.rootEntry,'navegador-completo.mjs');
console.log('PASS: checkpoint persistente, verificação sem falso sucesso, permissão, exclusão do registro, limite HTTP com histórico e navegador sob demanda.');

// The provider maps each system entry to a separate message. Strict templates reject a second one.
const systemOutput={system:['Original rules','Additional context']};const originalSystemArray=systemOutput.system;
await hooks['experimental.chat.system.transform']({model:{providerID:'ollama'}},systemOutput);
assert.equal(systemOutput.system,originalSystemArray);assert.equal(systemOutput.system.length,1);assert.match(systemOutput.system[0],/Original rules/);assert.match(systemOutput.system[0],/Additional context/);assert.match(systemOutput.system[0],/MEJAI runtime date/);
const wireMessages=[...systemOutput.system.map(content=>({role:'system',content})),{role:'user',content:'fixture'}];
assert(wireMessages.every((message,index)=>message.role!=='system'||index===0));
console.log('PASS strict chat template: one initial system message, all instructions retained, same mutable array.');
