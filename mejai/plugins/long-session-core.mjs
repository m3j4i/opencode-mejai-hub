export function humanText(message){
 const text=(message.parts||[]).filter(p=>p.type==='text'&&!p.synthetic&&!p.id?.startsWith('mejai-ledger-')).map(p=>p.text||'').join('\n').trim();
 if(/^\[(?:MEJAI autonomy|Automatic continuation|Recuperacao automatica)/.test(text)||/^(?:continue|continuar|cotinue|prossiga|go on|ok|yes|sim)[.!\s]*$/i.test(text))return '';
 return text.split('[MEJAI autonomy]')[0].trim();
}
export function humanRequests(messages){return messages.filter(m=>m.info?.role==='user').map(m=>({id:m.info.id,text:humanText(m)})).filter(m=>m.text);}
export function compactEvidence(s){return JSON.stringify({originalRequest:s.objective?.slice(0,5000),recentRequests:(s.requests||[]).slice(-4).map(t=>t.slice(0,1600)),steps:(s.steps||[]).slice(-25),artifacts:Object.fromEntries(Object.entries(s.artifacts||{}).slice(-12)),checks:(s.checks||[]).slice(-4),failures:(s.failures||[]).slice(-3)}).slice(0,14000);}
export function recoveryContext(messages,record){
 const human=humanRequests(messages);const tools=messages.slice(-12).flatMap(m=>m.parts||[]).filter(p=>p.type==='tool');
 const evidence=tools.slice(-3).map(p=>({tool:p.tool,status:p.state?.status,exit:p.state?.metadata?.exit,result:String(p.state?.error||p.state?.output||'').slice(-900)}));
 return '\nOriginal human requirements: '+(human[0]?.text||record.objective||'See saved checkpoint').slice(0,5000)+'\nLatest human corrections: '+human.slice(-3).map(m=>m.text.slice(0,1200)).join('\n')+'\nAutonomy goal: '+(record.objective||'').slice(0,2000)+'\nRecent execution evidence: '+JSON.stringify(evidence)+'\nRecovery: perform one concrete diagnostic or repair action now. A promise to debug is not progress. If an expensive pipeline failed, inspect the input/output counts and validate one representative unit BEFORE rerunning it. Persist successful batches and resume only missing units. Never substitute a different language, source, dataset or sample for the requested complete result. Treat missing inputs as a failure, not an empty successful artifact. If there is no feasible authorized action, report the exact blocker with [MEJAI autonomy: blocked].';
}
