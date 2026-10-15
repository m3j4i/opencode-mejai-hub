
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {decision,continuation} from './autonomy-core.mjs';
export default async({client})=>{
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dados/autonomy');fs.mkdirSync(root,{recursive:true});
 const timers=new Map(),running=new Set();let disposed=false;
 const file=id=>path.join(root,id+'.json');
 function read(id){if(!/^ses_[\w-]+$/.test(id||''))return null;try{return JSON.parse(fs.readFileSync(file(id),'utf8'));}catch{return null;}}
 function write(s){const tmp=file(s.sessionID)+'.plugin.tmp';fs.writeFileSync(tmp,JSON.stringify({...s,updated:Date.now()},null,2));fs.renameSync(tmp,file(s.sessionID));}
 function valid(s){return s?.enabled&&s.runID===process.env.MEJAI_RUN_ID;}
 function pause(id,reason){const s=read(id);if(!valid(s))return;write({...s,enabled:false,status:'paused',reason});clearTimeout(timers.get(id));timers.delete(id);}
 const data=async p=>{const r=await p;if(r?.error)throw Error('OpenCode request failed.');return r?.data??r;};
 async function advance(id){if(disposed||running.has(id))return;const s=read(id);if(!valid(s))return;running.add(id);
  try{
   const states=await data(client.session.status());if(states[id]?.type&&states[id].type!=='idle')return;
   const messages=await data(client.session.messages({path:{id}}));const todos=await data(client.session.todo({path:{id}}));
   const next=decision(messages,todos,s);if(next.action==='wait')return;
   const current=read(id);if(disposed||!valid(current)||current.generation!==s.generation)return;
   if(next.action!=='continue'){write({...current,enabled:false,status:next.action==='complete'?'reported complete':'paused',reason:next.reason});return;}
   const latest=await data(client.session.messages({path:{id}}));if(latest.at(-1)?.info.id!==next.message)return;
   const final=read(id);if(!valid(final)||final.generation!==s.generation||disposed)return;
   write({...final,status:'working',turns:final.turns+1,lastMessage:next.message,fingerprint:next.fingerprint,recentFingerprints:[...(final.recentFingerprints||[]),next.fingerprint].slice(-4),stalled:next.stalled,lastAction:next.stalled?'Recovery — no new evidence':'Continuing verified work'});
   await data(client.session.promptAsync({path:{id},body:{model:next.model,agent:next.agent,parts:[{type:'text',text:continuation+(next.stalled?' Diagnose the last failure and change the approach; do not repeat it.':''),synthetic:true,metadata:{mejaiAutomation:true}}]}}));
  }catch(e){pause(id,e.message);}finally{running.delete(id);}
 }
 let watching=false;
 const watchdog=setInterval(async()=>{if(disposed||watching)return;watching=true;try{for(const name of fs.readdirSync(root)){if(!/^ses_[\w-]+\.json$/.test(name))continue;const id=name.slice(0,-5),s=read(id);if(!valid(s))continue;if(Date.now()-s.started>=s.minutes*60000){pause(id,'Runtime limit reached. Current turn cancelled; resume explicitly if needed.');try{await client.session.abort({path:{id}});}catch{} }else if(!running.has(id)&&!timers.has(id)){advance(id);}}}catch{}finally{watching=false;}},5000);watchdog.unref?.();
 return {'experimental.chat.messages.transform':async(_input,output)=>{for(const m of output.messages||[]){if(m.info?.role!=='user')continue;for(const p of m.parts||[]){if(p.type==='text'&&/^\[MEJAI autonomy\]/.test(p.text||'')){p.text=continuation;p.synthetic=true;}}}},dispose:async()=>{disposed=true;clearInterval(watchdog);for(const t of timers.values())clearTimeout(t);},event:async({event})=>{
  const p=event.properties||{},id=p.sessionID||p.info?.sessionID;if(!id)return;
  if(['permission.asked','question.asked','session.error','session.deleted'].includes(event.type)){pause(id,event.type==='session.error'?'Execution stopped or failed. Review the chat.':'Waiting for your response in the chat. Resume autonomy afterward.');return;}
  if(event.type==='session.idle'&&!timers.has(id)&&valid(read(id))){const t=setTimeout(()=>{timers.delete(id);advance(id);},1200);t.unref?.();timers.set(id,t);}
 }};
};
