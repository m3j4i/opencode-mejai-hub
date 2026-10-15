import {createHash} from 'node:crypto';
const marker='[MEJAI autonomy]';
export const continuation=marker+' Continue the next unfinished step. Check evidence before marking completion.';
export const autonomyPolicy='Autonomy: infer a short actionable checklist and observable acceptance criteria from the human request yourself, using todowrite. Do not ask the user to write a planning prompt or a completion prompt. Preserve scope and human corrections. Act on the next unfinished step, validate a representative unit before expensive batch work, preserve successful batches, and replan after failed evidence instead of repeating a failed command. Provide concise progress summaries only when something changes. Finish only with verified deliverables and all todos completed or cancelled with reasons, then use [MEJAI autonomy: complete]. If genuinely blocked, state the missing input and use [MEJAI autonomy: blocked]. Never claim checks you did not run.';
export function decision(messages,todos,record,now=Date.now()){
 const last=messages.at(-1);if(last?.info?.role!=='assistant'||!last.info.time?.completed)return {action:'wait'};
 if(last.info.error)return {action:'pause',reason:'The model reported an error. Review the chat before resuming.'};
 if(record.lastMessage===last.info.id)return {action:'wait'};
 const text=(last.parts||[]).filter(p=>p.type==='text').map(p=>p.text||'').join('\n');
 if(text.includes('[MEJAI autonomy: blocked]'))return {action:'pause',reason:'The agent needs input or an unavailable resource. Review the chat.'};
 if(text.includes('[MEJAI autonomy: complete]')&&todos.some(t=>t.status==='completed')&&todos.every(t=>['completed','cancelled'].includes(t.status)))return {action:'complete',reason:'The agent reports that the acceptance criteria were checked. Review its evidence and deliverable.'};
 if(now-record.started>=record.minutes*60000||record.turns>=record.maxTurns)return {action:'pause',reason:'The configured runtime or continuation limit was reached. Review progress and resume if needed.'};
 // A changed answer alone is not progress: compare completed tasks and successful tool results.
 const lastUser=messages.findLastIndex(m=>m.info.role==='user');
 const evidence=messages.slice(lastUser+1).flatMap(m=>m.parts||[]).filter(p=>p.type==='tool'&&p.state?.status==='completed'&&!(p.state?.metadata?.exit)&&!/^COMANDO_FALHOU|^DOWNLOAD_INVALIDO/.test(p.state?.output||'')&&p.tool!=='todowrite').map(p=>[p.tool,p.state.input,p.state.output]);
 const fingerprint=createHash('sha256').update(JSON.stringify({todos:todos.map(t=>[t.content,t.status]),evidence})).digest('hex');
 const stalled=(!evidence.length||fingerprint===record.fingerprint||(record.recentFingerprints||[]).includes(fingerprint))?(record.stalled||0)+1:0;
 if(stalled>=3)return {action:'pause',reason:'Three continuations made no observable progress. Review the blocker before resuming.'};
 return {action:'continue',fingerprint,stalled,message:last.info.id,model:{providerID:last.info.providerID,modelID:last.info.modelID},agent:last.info.agent||'build'};
}
