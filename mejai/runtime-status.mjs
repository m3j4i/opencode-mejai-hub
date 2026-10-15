import fs from 'node:fs/promises';import path from 'node:path';
export function summarizeAutonomy(records,server,states){
 if(!server)return {state:'stopped',enabled:0,working:0,label:'Stopped — agent offline'};
 if(states===null)return {state:'unknown',enabled:0,working:0,label:'Status unavailable'};
 const active=records.filter(r=>r.enabled&&r.runID&&r.runID===server.runID&&!server.legacy);
 const working=active.filter(r=>['busy','retry'].includes(states[r.sessionID]?.type)).length;
 const stale=records.some(r=>r.enabled&&r.runID!==server.runID);
 return {state:working?'working':active.length?'ready':'stopped',enabled:active.length,working,label:working?'Running · '+working+' conversation'+(working===1?'':'s'):active.length?'Enabled · '+active.length+' conversation'+(active.length===1?'':'s'):stale?'Paused — resume after restart':'Disabled / paused'};
}
export async function runtimeStatus(base,server,request){
 let states=null;try{if(server)states=await request(server.url+'/session/status');}catch{}
 const folder=path.join(base,'dados/autonomy');let records=[],readError=false;
 try{const names=await fs.readdir(folder);for(const name of names.filter(n=>/^ses_[\w-]+\.json$/.test(n))){try{records.push(JSON.parse(await fs.readFile(path.join(folder,name),'utf8')));}catch{readError=true;}}}catch(e){if(e.code!=='ENOENT')readError=true;}
 const working=states&&Object.values(states).some(s=>['busy','retry'].includes(s.type));
 return {agent:{state:!server?'stopped':states===null?'unknown':working?'working':'ready',label:!server?'Stopped':states===null?'Status unavailable':working?'Working':'Ready'},autonomy:readError&&server?{state:'unknown',enabled:0,working:0,label:'Could not read autonomy status'}:summarizeAutonomy(records,server,states),checkedAt:Date.now()};
}
