import {codeDeliveryPolicy} from "./code-delivery-policy.mjs";
import {torSearchPolicy} from "./tor-search-policy.mjs";
import {autonomyPolicy} from './autonomy-core.mjs';
import {humanRequests,compactEvidence} from './long-session-core.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {completenessWarning} from './content-completeness.mjs';
import {textArtifactPaths} from './content-completeness.mjs';
import {reportedFiles,outputFile} from './execution-core.mjs';
import {unwrapCommand} from './portable-shell.mjs';
export default async({directory})=>{
 const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const folder=path.join(base,'dados/progresso');fs.mkdirSync(folder,{recursive:true});
 const cache=new Map();
 function state(id){if(!/^[\w-]{1,120}$/.test(id||''))return null;if(!cache.has(id)){try{cache.set(id,JSON.parse(fs.readFileSync(path.join(folder,id+'.json'),'utf8')));}catch{cache.set(id,{sessionID:id,artifacts:{},steps:[],failures:[]});}}return cache.get(id);}
 function save(s){s.updated=Date.now();for(const target of [path.join(folder,s.sessionID+'.json'),path.join(folder,'atual.json')]){const temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(s,null,2));fs.renameSync(temp,target);}}
 return {
  'experimental.chat.system.transform':async(_input,output)=>{
   const today=new Date().toLocaleDateString('en-CA');
   output.system??=[];const instructions=[...output.system,autonomyPolicy,torSearchPolicy,codeDeliveryPolicy,'MEJAI runtime date: '+today+'. Platform: '+process.platform+'. For current research, use this date, verify publication dates and distinguish older evidence from current conditions. Link sources next to quantitative claims; never invent statistics or treat a search excerpt as verified full-page evidence. Local files use read, not read_mcp_resource.'];
   // Strict chat templates require a single system message at index zero.
   output.system.splice(0,output.system.length,instructions.filter(Boolean).join('\n\n'));
  },
  'experimental.session.compacting':async(input,output)=>{const s=state(input.sessionID);if(!s)return;output.context??=[];output.context.push('Preserve these human requirements and execution evidence in the continuation summary. Automated reminders are not new human requirements. '+compactEvidence(s));},
  'tool.execute.after':async(input,output)=>{
   const s=state(input.sessionID);if(!s)return;
   if(input.tool==='todowrite')s.steps=(input.args?.todos||[]).slice(0,80);
   const command=input.tool==='bash'?unwrapCommand(input.args?.command||''):'';
   const targets=['write','edit'].includes(input.tool)?[input.args?.filePath]:command?[outputFile(command),...textArtifactPaths(command),...reportedFiles(output.output||'')]:[];
   for(const target of targets.filter(Boolean).slice(0,20)){
    const file=path.resolve(directory||base,target);let evidence;
    try{const stat=fs.statSync(file);const warning=completenessWarning(file);evidence={exists:true,bytes:stat.size,syntax:output.metadata?.syntaxCheck||'not_verified',needsReview:!!warning,functional:'not_verified'};}catch(e){evidence={exists:false,error:e.message};}
    s.artifacts[file]=evidence;
    // Bound retained context; the ledger stores evidence, never file contents.
    const entries=Object.entries(s.artifacts);if(entries.length>60)s.artifacts=Object.fromEntries(entries.slice(-60));
   }
   if(command&&typeof output.metadata?.exit==='number')s.checks=[...(s.checks||[]),{command:command.slice(0,400),exit:output.metadata.exit,result:String(output.output||'').slice(-800),time:Date.now()}].slice(-8);
   if(output.metadata?.exit||output.metadata?.artifactValid===false||output.metadata?.syntaxCheck==='erro')s.failures=[...s.failures,{tool:input.tool,detail:String(output.output||'').slice(0,600),time:Date.now()}].slice(-6);
   s.lastTool=input.tool;s.state='working';save(s);
  },
  'experimental.chat.messages.transform':async(_input,output)=>{
   const messages=output.messages||[];const last=messages.at(-1);const s=state(last?.info?.sessionID);if(!s)return;
   const user=[...messages].reverse().find(m=>m.info?.role==='user');
   const humans=humanRequests(messages);if(humans.length){s.objective??=humans[0].text.slice(0,8000);s.request=humans.at(-1).id;const prior=(s.requests||[]).filter(t=>!/^\[(?:MEJAI autonomy|Automatic continuation|Recuperacao automatica)/.test(t));s.requests=[...new Set([...prior,...humans.map(m=>m.text.slice(0,2000))])].slice(-5);save(s);}
   // Rebuild the synthetic checkpoint once; do not grow it on repeated transformations.
   for(const message of messages)message.parts=(message.parts||[]).filter(p=>!p.id?.startsWith('mejai-ledger-'));
   for(const [file,evidence] of Object.entries(s.artifacts)){try{evidence.exists=fs.statSync(file).isFile();evidence.bytes=fs.statSync(file).size;evidence.needsReview=!!completenessWarning(file);}catch{evidence.exists=false;}}
   const context=compactEvidence(s);
   // Add a synthetic reminder to the existing last user message in this request only.
   if(user){user.parts??=[];user.parts.push({id:'mejai-ledger-'+Date.now(),type:'text',sessionID:s.sessionID,messageID:user.info.id,synthetic:true,text:'[MEJAI: execution evidence, not a new user request] '+context+'\nBefore finishing, compare all original requirements with the complete final artifacts. Existence and syntax do not prove behavior or coverage. Run appropriate checks and disclose what was not verified. Continue authorized pending work without repeating completed side effects. Errors above are historical evidence, not proof of a current failure.'});}
  },
  event:async({event})=>{
   const p=event.properties||{},id=p.sessionID||p.info?.sessionID||p.part?.sessionID;const s=state(id);if(!s)return;
   if(event.type==='session.deleted'){cache.delete(id);fs.rmSync(path.join(folder,id+'.json'),{force:true});try{const current=JSON.parse(fs.readFileSync(path.join(folder,'atual.json')));if(current.sessionID===id)fs.rmSync(path.join(folder,'atual.json'),{force:true});}catch{}return;}
   if(event.type==='session.status')s.state={busy:'working',retry:'retrying',idle:'idle; check the result in chat'}[p.status?.type]||p.status?.type;
   else if(event.type==='session.idle')s.state='idle; check the result in chat';
   else if(event.type==='permission.asked'||event.type==='question.asked')s.state='waiting for your answer in chat';
   else if(event.type==='session.error'){s.state='error; open the chat';s.error=String(p.error?.data?.message||p.error?.message||'Execution error').slice(0,500);}
   else if(event.type==='todo.updated')s.steps=(p.todos||[]).slice(0,80);
   else return;
   save(s);
  }
 };
};
