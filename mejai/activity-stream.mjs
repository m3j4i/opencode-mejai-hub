export async function forwardActivity(server,id,directory,res){
 const abort=new AbortController();res.once('close',()=>abort.abort());let timer;
 try{
  const response=await fetch(server.url+'/event?directory='+encodeURIComponent(directory),{signal:abort.signal});if(!response.ok)throw Error('OpenCode activity stream HTTP '+response.status);
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(': connected\n\n');
  timer=setInterval(()=>res.write(': heartbeat\n\n'),15000);timer.unref?.();
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  while(!abort.signal.aborted){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');let at;
   while((at=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,at);buffer=buffer.slice(at+2);const raw=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!raw)continue;let event;try{event=JSON.parse(raw);}catch{continue;}event=event.payload||event;const p=event.properties||event.data||{};if((p.sessionID||p.part?.sessionID||p.info?.sessionID)!==id)continue;if(!['message.part.updated','message.part.delta','message.updated','session.status','session.error','session.idle','todo.updated','question.asked','permission.asked'].includes(event.type))continue;if(res.writableLength>1024*1024)throw Error('Activity client too slow; reconnect to refresh.');res.write('data: '+JSON.stringify({type:event.type,properties:p})+'\n\n');}
   if(buffer.length>2e6)throw Error('Activity event exceeded the size limit.');
  }
 }catch(e){if(!abort.signal.aborted){if(res.headersSent)res.write('data: '+JSON.stringify({type:'stream.error',properties:{message:e.message}})+'\n\n');else{res.writeHead(502,{'Content-Type':'application/json'});res.write(JSON.stringify({error:e.message}));}}}finally{clearInterval(timer);abort.abort();res.end();}
}
