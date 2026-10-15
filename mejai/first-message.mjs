// Prepare connections and load weights ahead of the first message. Never generate text.
export function createPreparation({fetchImpl=fetch,now=Date.now,onChange=()=>{},retryMs=30000}={}){
 let job=null,epoch=0,abort=null,lastKey='',lastStarted=0;
 let state={status:'idle',steps:{}};
 const emit=()=>{try{onChange(structuredClone(state));}catch{}};
 function cancel(){epoch++;abort?.abort();abort=null;job=null;lastKey='';state={status:'idle',steps:{}};emit();}
 async function request(url,options,signal,timeout=45000){
  const response=await fetchImpl(url,{...options,signal:AbortSignal.any([signal,AbortSignal.timeout(timeout)])});
  if(!response.ok)throw Error('HTTP '+response.status);return response.json();
 }
 function begin({server,config,directory}){
  const selected=config.model||'',slash=selected.indexOf('/');
  if(slash<1)return Promise.resolve({status:'skipped',reason:'No model selected.'});
  const provider=selected.slice(0,slash),model=selected.slice(slash+1);
  const endpoint=config.provider?.[provider]?.options?.baseURL;
  const key=JSON.stringify([server,selected,endpoint,directory]);
  if(key===lastKey&&(job||now()-lastStarted<retryMs))return job||Promise.resolve(structuredClone(state));
  cancel();lastKey=key;lastStarted=now();const version=epoch;abort=new AbortController();const signal=abort.signal;
  state={status:'preparing',model:selected,started:now(),steps:{}};emit();
  const update=(name,value)=>{if(version===epoch){state.steps[name]=value;emit();}};
  const work=(async()=>{
   try{
    const query='directory='+encodeURIComponent(directory);
    const sessions=await request(server+'/session/status?'+query,{},signal,5000);
    if(Object.values(sessions).some(s=>s.type!=='idle')){if(version===epoch){state.status='deferred';emit();}return;}
    const steps=[['tools',async()=>{
     // Initialize only the active MCP connections and schemas, never execute tools.
     const connections=await request(server+'/mcp?'+query,{},signal);
     const failed=Object.entries(connections).filter(([,s])=>!['connected','disabled'].includes(s.status));
     if(failed.length)throw Error('Tools unavailable: '+failed.map(([name])=>name).join(', '));
     await request(server+'/experimental/tool?'+query+'&provider='+encodeURIComponent(provider)+'&model='+encodeURIComponent(model),{},signal);
     return {status:'ready'};
    }]];
    if(provider==='ollama')steps.push(['model',async()=>{
     let url;try{url=new URL(endpoint);}catch{throw Error('Ollama endpoint is not configured.');}
     if(!['http:','https:'].includes(url.protocol)||!url.pathname.replace(/\/$/,'').endsWith('/v1'))throw Error('Invalid Ollama endpoint.');
     url.pathname=url.pathname.replace(/\/v1\/?$/,'');url.search='';url.hash='';const root=url.href.replace(/\/$/,'');
     const resident=await request(root+'/api/ps',{},signal,3000);
     if(!Array.isArray(resident.models))throw Error('Invalid Ollama model status.');
     const same=name=>name===model||!model.includes(':')&&name===model+':latest';
     if(resident.models.some(entry=>same(entry.name)||same(entry.model)))return {status:'ready',alreadyLoaded:true};
     // Empty request is Ollama's documented load-only operation. Do not set
     // prompt, messages, keep_alive, options, context, or generation parameters.
     const result=await request(root+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model})},signal,900000);
     if(result.error)throw Error(result.error);
     if(result.done!==true||result.response||result.thinking||(result.eval_count||0)>0)throw Error('Ollama did not confirm a load-only response.');
     return {status:'ready',alreadyLoaded:false,loadMs:Math.round((result.load_duration||0)/1e6)};
    }]);
    else if(provider==='colibri')steps.push(['model',async()=>{
     const models=await request(endpoint.replace(/\/$/,'')+'/models',{},signal,5000);
     if(!models.data?.some(entry=>entry.id===model))throw Error('Start the selected Colibri model first.');
     return {status:'ready',alreadyLoaded:true};
    }]);
    await Promise.all(steps.map(async([name,task])=>{
     const started=now();update(name,{status:'preparing'});
     try{update(name,{...await task(),ms:now()-started});}catch(error){if(!signal.aborted)update(name,{status:'unavailable',ms:now()-started,error:error.message});}
    }));
    if(version===epoch){state.status=Object.values(state.steps).every(s=>s.status==='ready')?'ready':'partial';state.finished=now();emit();}
   }catch(error){if(version===epoch&&!signal.aborted){state.status='unavailable';state.error=error.message;emit();}}
  })();
  job=work.finally(()=>{if(version===epoch)job=null;});return job.then(()=>structuredClone(state));
 }
 return {begin,cancel,state:()=>structuredClone(state)};
}
