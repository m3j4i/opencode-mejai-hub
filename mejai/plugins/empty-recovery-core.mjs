import {createHash} from 'node:crypto';
const automatic=text=>/^\[(?:Recuperacao automatica de resposta vazia|Automatic continuation)\]/.test(text||'');
export function recoveryCandidate(messages,started=0,todos=[]){
 const last=messages.at(-1);if(!last||last.info?.role!=='assistant'||last.info.finish!=='stop'||last.info.error||last.info.time?.created<started)return;
 if(last.parts?.some(p=>p.type==='tool'))return;
 const text=(last.parts||[]).filter(p=>p.type==='text').map(p=>p.text||'').join('\n').trim();
 const blockedOrQuestion=/[?]|\b(?:aguard\w*|impedimento|nao posso|não posso|nao consigo|não consigo|quando voc[eê]|se voc[eê]|preciso que voc[eê]|autoriza\w*|permiss[aã]o|cannot|can't|waiting for|permission|please provide|blocked)\b/i.test(text);
 const promise=text.length<800&&!blockedOrQuestion&&/(?:^|[.!\n]\s*)(?:(?:Agora|Now)\s+)?(?:I (?:will|am going to)\s+(?:create|fix|test|check|download|open|run|continue|rewrite)|Vou\s+(?:criar|corrigir|testar|verificar|baixar|abrir|voltar|tentar|executar|continuar|reescrever)|Deixe-me\s+(?:verificar|capturar|testar|abrir|continuar))\b/i.test(text);
 const danglingHeading=text.length<200&&!text.includes('\n')&&/(?:verifica[cç][aã]o final|resultados?|resumo|arquivos(?: criados)?|testes(?: executados)?):\s*$/i.test(text)&&messages.some(m=>m.parts?.some(p=>p.type==='tool'));
 let root=-1,retries=0;for(let i=messages.length-1;i>=0;i--){const m=messages[i];if(m.info?.role!=='user')continue;if(m.parts?.some(p=>p.type==='text'&&automatic(p.text))){retries++;continue;}root=i;break;}
 if(root<0)return;
 const current=messages.slice(root);
 const tools=current.flatMap(m=>(m.parts||[]).filter(p=>p.type==='tool'));
 // Long tasks can exceed six continuations when the latest attempt produced
 // new successful evidence. Repeated results and failed commands do not count.
 if(retries>=6){
  const split=current.map(m=>m.info?.role==='user'&&m.parts?.some(p=>automatic(p.text))).lastIndexOf(true);
  const successes=items=>items.flatMap(m=>m.parts||[]).filter(p=>p.type==='tool'&&p.tool!=='todowrite'&&p.state?.status==='completed'&&!p.state?.error&&!(Number(p.state?.metadata?.exit)||0)&&p.state?.metadata?.artifactValid!==false);
  const fingerprint=p=>createHash('sha256').update(JSON.stringify([p.tool,p.state?.input,p.state?.output])).digest('hex');
  const previous=new Set(successes(current.slice(0,split)).map(fingerprint));
  if(!successes(current.slice(split)).some(p=>!previous.has(fingerprint(p))))return;
 }

 if(retries>=2){const since=current.slice(current.map(m=>m.info?.role==='user'&&m.parts?.some(p=>automatic(p.text))).lastIndexOf(true));if(!since.some(m=>m.parts?.some(p=>p.type==='tool')))return;}
 // A short argument about a navigation guard is not a completed execution.
 // Only recover this diagnostic when that guard actually failed in this turn.
 const guardStall=text.length<350&&!blockedOrQuestion&&/\b(?:link|url)\b/i.test(text)&&/(?:permitido navegar|n[aã]o h[aá] URL inventada)/i.test(text)&&tools.slice(-3).some(p=>p.state?.status==='error'&&/URL_SEM_ORIGEM/.test(p.state?.error||''));
 const diagnostic=text.length<650&&!blockedOrQuestion&&tools.length>0&&/^(?:A fun[cç][aã]o|O problema [eé]|Fontes confirmadas|The (?:problem|issue) is|I need to (?:fix|check|test))/i.test(text);
 const unfinished=Array.isArray(todos)&&todos.some(t=>['pending','in_progress'].includes(t.status))&&!blockedOrQuestion&&tools.length>0;
 if(text&&!promise&&!danglingHeading&&!guardStall&&!diagnostic&&!unfinished)return;
 if(promise&&!/^(?:(?:Agora|Now)\s+)?(?:Vou|I (?:will|am going to))\b/i.test(text)&&!tools.length)return;
 if(danglingHeading&&!messages.slice(root).some(m=>m.parts?.some(p=>p.type==='tool')))return;
 if(messages.slice(root).some(m=>m.info?.error))return;
 return {last,root:messages[root],retries};
}
