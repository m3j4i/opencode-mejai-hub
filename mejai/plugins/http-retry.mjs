export default async({client}={})=>{
 const failures=new Map();
 function request(input,args){let name=input.tool||'';while(/habilidades_call$|browser_tool_call$/.test(name)){name=args?.name||'';args=args?.arguments||{};}return {name,url:args?.url};}
 function key(id,url){try{const u=new URL(url);u.hash='';return id+'|'+u.href;}catch{return null;}}
 return {
  'tool.execute.before':async(input,output)=>{
   const r=request(input,output.args);const k=key(input.sessionID,r.url);if(!k)return;
   let count=failures.get(k)||0;
   if(client?.session?.messages){const response=await client.session.messages({path:{id:input.sessionID}});const messages=response.data??response;
    if(Array.isArray(messages)){const failed=messages.flatMap(m=>m.parts||[]).filter(p=>p.type==='tool'&&key(input.sessionID,request({tool:p.tool},p.state?.input).url)===k&&/\b(?:403|404)\b/.test(String(p.state?.error||p.state?.output||'')));count=Math.max(count,failed.length);}}
   if(count>=2)throw Error('FONTE_REPETIDAMENTE_INDISPONIVEL: this address failed twice in this session. Use another discovered source or report the blocker. Switching tools does not repair a nonexistent URL.');
  },
  'tool.execute.after':async(input,output)=>{const r=request(input,input.args);const k=key(input.sessionID,r.url);if(!k)return;const text=String(output.output||'');if(/(?:status(?:code| code)?|HTTP|response|erro)[^\n]{0,25}\b(?:403|404)\b/i.test(text)){failures.set(k,(failures.get(k)||0)+1);output.output=text+'\nMEJAI: 403 indicates denied access and 404 a missing address. Do not invent another path. Discover another source or try the browser once.';}},
  event:async({event})=>{if(event.type==='session.deleted')for(const k of failures.keys())if(k.startsWith(event.properties.sessionID+'|'))failures.delete(k);}
 };
};
