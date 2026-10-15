import assert from 'node:assert/strict';import {recoveryCandidate} from '../../plugins/empty-recovery-core.mjs';import plugin from '../../plugins/empty-recovery.mjs';
const user={info:{role:'user',id:'u',agent:'build'},parts:[{type:'text',text:'crie um arquivo de teste'}]};
const tool={info:{role:'assistant'},parts:[{type:'tool',state:{status:'completed'}}]};
const empty={info:{role:'assistant',id:'a',finish:'stop',time:{created:Date.now()+100},providerID:'ollama',modelID:'test'},parts:[{type:'reasoning',text:'...'}]};
const messages=[user,tool,empty];assert(recoveryCandidate(messages));assert(!recoveryCandidate(messages,Date.now()+10000));
assert(!recoveryCandidate([user,tool,{...empty,parts:[{type:'text',text:'Nao posso continuar por falta de informacao.'}]}]));
assert(recoveryCandidate([user,tool,{...empty,parts:[{type:'text',text:'Vou voltar para a pagina original e clicar no download.'}]}]));
assert(!recoveryCandidate([user,tool,{...empty,parts:[{type:'text',text:'Vou testar quando voce fornecer o acesso. Preciso da sua credencial.'}]}]));
assert(!recoveryCandidate([user,tool,{...empty,info:{...empty.info,error:{name:'MessageAbortedError'}}}]));
const retry={info:{role:'user'},parts:[{type:'text',text:'[Recuperacao automatica de resposta vazia] ...'}]};assert(!recoveryCandidate([...messages,retry,empty,retry,empty]));assert(recoveryCandidate([user,empty]));
let calls=[];const client={session:{messages:async()=>({data:messages}),get:async()=>({data:{}}),promptAsync:async r=>{calls.push(r);return {};}}};
const hook=await plugin({client});await hook.event({event:{type:'session.idle',properties:{sessionID:'s'}}});await new Promise(r=>setTimeout(r,900));assert.equal(calls.length,1);await hook.event({event:{type:'session.idle',properties:{sessionID:'s'}}});await new Promise(r=>setTimeout(r,900));assert.equal(calls.length,1);
const cancel=await plugin({client});await cancel.event({event:{type:'session.idle',properties:{sessionID:'s'}}});await cancel.event({event:{type:'session.error',properties:{sessionID:'s'}}});await new Promise(r=>setTimeout(r,900));assert.equal(calls.length,1);
console.log('PASS: retoma vazio apos ferramentas uma vez por mensagem; limita tentativas; preserva resposta, recusa, cancelamento e historico antigo.');

// Races: cancellation/new user activity while a recovery read is awaiting.
for(const kind of ['session.error','message.updated','session.status','dispose','changed']){
 let release,enteredResolve;const entered=new Promise(r=>enteredResolve=r);let sent=0,reads=0;
 const local={session:{messages:async()=>{reads++;return {data:kind==='changed'&&reads>1?[...messages,{info:{role:'user',id:'new'},parts:[]}]:messages};},get:async()=>{enteredResolve();await new Promise(r=>release=r);return {data:{}};},promptAsync:async()=>{sent++;return {};}}};
 const h=await plugin({client:local});
 messages.at(-1).info.time.created=Date.now()+10000;
 await h.event({event:{type:'session.idle',properties:{sessionID:'race'}}});const keepAlive=setInterval(()=>{},1000);await entered;clearInterval(keepAlive);
 if(kind==='dispose')await h.dispose();
 else if(kind!=='changed')await h.event({event:{type:kind,properties:{sessionID:'race',info:{role:'user',sessionID:'race',id:'new-user'},status:{type:'busy'}}}});
 release();await new Promise(r=>setTimeout(r,50));assert.equal(sent,0,kind);await h.dispose();
}
console.log('PASS: mensagem nova, cancelamento, tarefa ocupada e encerramento impedem retomada obsoleta.');

let duplicateCalls=0;
const duplicateClient={session:{messages:async()=>({data:messages}),get:async()=>({data:{}}),promptAsync:async()=>{duplicateCalls++;return {};}}};
messages.at(-1).info.time.created=Date.now()+10000;
const duplicateHook=await plugin({client:duplicateClient});
const userEvent={event:{type:'message.updated',properties:{sessionID:'duplicate',info:{role:'user',id:'same-user',time:{created:Date.now()}}}}};
await duplicateHook.event(userEvent);
await duplicateHook.event({event:{type:'session.idle',properties:{sessionID:'duplicate'}}});
await duplicateHook.event(userEvent);
await new Promise(r=>setTimeout(r,900));assert.equal(duplicateCalls,1);await duplicateHook.dispose();
console.log('PASS: atualizacao tardia do resumo da mesma mensagem nao cancela retomada.');

assert(recoveryCandidate([user,tool,{...empty,parts:[{type:'text',text:'Tarefas concluídas. Verificação final:'}]}]));
assert(!recoveryCandidate([user,tool,{...empty,parts:[{type:'text',text:'Resultado: 79,90.'}]}]));
console.log('PASS: cabecalho final abandonado pode ser retomado; resposta com resultado preservada.');
for(const text of ['A página ainda está carregando a seção de download. Deixe-me capturar o snapshot completo novamente para ver se os botões apareceram. Vou verificar quais botões ou links de download estão disponíveis atualmente na página.','Os arquivos foram localizados. Vou verificar o conteúdo.']) assert(recoveryCandidate([user,tool,{...empty,parts:[{type:'text',text}]}]));
for(const text of ['O arquivo foi verificado e está pronto.','Quando você quiser, vou testar.','Vou verificar se você autorizar.','Exemplo: Vou baixar o arquivo.']) assert(!recoveryCandidate([user,tool,{...empty,parts:[{type:'text',text}]}]));
const guard={info:{role:'assistant'},parts:[{type:'tool',state:{status:'error',error:'URL_SEM_ORIGEM'}}]};
const stalled={...empty,parts:[{type:'text',text:'O link aparece na busca exa anterior. É permitido navegar. Não há URL inventada.'}]};
assert(recoveryCandidate([user,guard,stalled]));assert(!recoveryCandidate([user,tool,stalled]));
console.log('PASS: promessas apos contexto e bloqueio de URL; preserva conclusoes e pedidos de autorizacao.');


// A large deliverable must not stop simply because six useful stages completed.
const longWork=[user];
for(let i=0;i<8;i++)longWork.push(retry,{info:{role:'assistant'},parts:[{type:'tool',tool:'write',state:{status:'completed',input:{filePath:'chapter-'+i+'.txt'},output:'Saved chapter '+i}}]}, {...empty,parts:[{type:'text',text:'I will continue.'}]});
assert(recoveryCandidate(longWork,0,[{status:'pending'}]),'new successful work permits long-task continuation');
const repeatWork=[...longWork,retry,longWork.at(-2),longWork.at(-1)];
assert(!recoveryCandidate(repeatWork,0,[{status:'pending'}]),'repeating the same successful result is not progress');
const failedWork=[...longWork,retry,{info:{role:'assistant'},parts:[{type:'tool',tool:'bash',state:{status:'completed',input:{command:'failing-new-command'},output:'failure',metadata:{exit:1}}}]},longWork.at(-1)];
assert(!recoveryCandidate(failedWork,0,[{status:'pending'}]),'failed commands cannot extend automatic continuation');
console.log('PASS: long tasks continue beyond six stages only with new successful tool evidence.');
