import {recoveryCandidate} from './empty-recovery-core.mjs';
import fs from 'node:fs/promises';
const logURL=new URL('../logs/retomadas.jsonl',import.meta.url);
async function record(value){try{await fs.mkdir(new URL('../logs/',import.meta.url),{recursive:true});await fs.appendFile(logURL,JSON.stringify({time:new Date().toISOString(),...value})+'\n');}catch{}}
const marker='[Automatic continuation]';
const prompt=marker+' The previous response ended without a completed result. Review the original user request, saved checklist, tool evidence and existing files. Continue only authorized pending work. A diagnosis, sample or promise is not completion. Do not repeat completed side effects. Verify scope and functionality before claiming success. If genuinely blocked, state the exact blocker and what remains. Reply in the language of the latest substantive human request, not the language of this automatic message.';
export default async({client})=>{
 const started=Date.now(),seen=new Set(),blocked=new Set(),pending=new Map(),versions=new Map(),running=new Set(),users=new Map();
 let disposed=false;
 function invalidate(id){versions.set(id,(versions.get(id)||0)+1);clearTimeout(pending.get(id));pending.delete(id);}
 async function recover(id){
  if(disposed||blocked.has(id)||running.has(id))return;
  running.add(id);const version=versions.get(id)||0;
  const stale=()=>disposed||blocked.has(id)||(versions.get(id)||0)!==version;
  try{
   const response=await client.session.messages({path:{id}});const messages=response.data??response;
   if(Array.isArray(messages)&&messages.some(m=>m.parts?.some(p=>p.type==='text'&&p.text?.includes('[MEJAI autonomy]'))))return;
   if(stale()||!Array.isArray(messages))return;
   let todos=[];try{const response=await client.session.todo?.({path:{id}});todos=response?.data??response??[];}catch{}
   const found=recoveryCandidate(messages,started,todos);if(!found||seen.has(found.last.info.id))return;
   const session=await client.session.get({path:{id}});
   if(session.error)throw Error('Could not confirm the session for automatic continuation.');
   if(stale()||(session.data??session).parentID)return;
   // A new user message or completed answer wins over automatic recovery.
   const latest=await client.session.messages({path:{id}});const current=latest.data??latest;
   if(stale()||!Array.isArray(current)||current.at(-1)?.info?.id!==found.last.info.id)return;
   seen.add(found.last.info.id);const original=found.root.info;
   const result=await client.session.promptAsync({path:{id},body:{model:{providerID:found.last.info.providerID,modelID:found.last.info.modelID},agent:original.agent||found.last.info.agent||'build',...(original.variant?{variant:original.variant}:{}),parts:[{type:'text',text:prompt}]}});
   if(result?.error)throw Error('OpenCode rejected automatic continuation.');
   await record({sessionID:id,messageID:found.last.info.id,event:'retomada',attempt:found.retries+1});
  }finally{running.delete(id);}
 }
 return {
  dispose:async()=>{disposed=true;for(const timer of pending.values())clearTimeout(timer);pending.clear();},
  event:async({event})=>{
   if(disposed)return;
   const id=event.properties?.sessionID||event.properties?.info?.sessionID;if(!id)return;
   if(event.type==='session.error'||event.type==='session.deleted'){blocked.add(id);invalidate(id);return;}
   if(event.type==='message.updated'&&event.properties.info?.role==='user'){
    const info=event.properties.info,previous=users.get(id);
    if(info.id&&info.id!==previous?.id&&(!previous||!info.time?.created||info.time.created>=previous.created)){
     users.set(id,{id:info.id,created:info.time?.created||Date.now()});blocked.delete(id);invalidate(id);
    }
    return;
   }
   if(event.type==='session.status'&&['busy','retry'].includes(event.properties?.status?.type)){invalidate(id);return;}
   if(event.type==='session.idle'&&!pending.has(id)){
    const timer=setTimeout(()=>{pending.delete(id);recover(id).catch(e=>record({sessionID:id,event:'erro',message:e.message}));},750);timer.unref?.();pending.set(id,timer);
   }
  }
 };
};
