import {urlsIn,evidenceFrom,approved} from './url-evidence-core.mjs';
export default async({client})=>{
 const warnings=new Map();
 return {
  'tool.execute.before':async(input,output)=>{
   let tool=input.tool||'',args=output.args||{};
   for(let depth=0;depth<4&&/browser_tool_call$|habilidades_call$/.test(tool);depth++){tool=args.name||'';args=args.arguments||{};}
   let candidates=[];
   if(tool==='webfetch'||/browser_navigate$|browser_download$|browser_download_file$|^fetch$|^navigate_page$|^new_page$/.test(tool))candidates=[args.url,...(args.urls||[])].filter(Boolean);
   else if(['bash','start_process'].includes(tool)&&/curl|wget|Invoke-WebRequest|Invoke-RestMethod|requests\.|httpx\.|urllib|fetch\s*\(/i.test(args.command||''))candidates=urlsIn(args.command);
   if(!candidates.length)return;
   const r=await client.session.messages({path:{id:input.sessionID}});const messages=r.data??r;
   const known=evidenceFrom(Array.isArray(messages)?messages:[]);
   const unknown=candidates.filter(url=>!approved(url,known));
   if(unknown.length)warnings.set(input.callID||input.sessionID,'SOURCE_CHECK: URL provenance was not found in the available history. This request was allowed; verify the actual response and source before using it. For undocumented endpoints, read API documentation or search for a real link. URL: '+unknown.join(', '));
  },
  'tool.execute.after':async(input,output)=>{const key=input.callID||input.sessionID;const warning=warnings.get(key);warnings.delete(key);if(warning)output.output=(output.output||'')+'\n'+warning;}
 };
};
