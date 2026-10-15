import {completenessWarning,textArtifactPaths} from './content-completeness.mjs';
import {checkSyntax} from './artifact-syntax.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {toolBins,localPath,outputFile,reportedFiles,invalidArtifact,fixQuotedExecutable,normalizeTarget} from './execution-core.mjs';
import {urlsIn} from './url-evidence-core.mjs';
import {wrapCommand,unwrapCommand} from './portable-shell.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../ferramentas');
let mappings=[];try{mappings=JSON.parse(fs.readFileSync(path.join(root,'../caminhos-anteriores.json'),'utf8'));}catch{}
function remap(value){for(const m of mappings){const dest=path.resolve(root,'..',m.to);for(const [old,next] of [[m.from,dest],[m.from.replaceAll('\\','/'),dest.replaceAll('\\','/')]])value=value.split(old).join(next);}return value;}
export default async ({client,directory})=>{
 const rejected=new Map();
 return {
  'tool.definition':async(input,output)=>{
   if(input.toolID==='read_mcp_resource')output.description+=' Read only resource URIs advertised by connected MCP servers. For local files, use read with filePath. On-demand adapters such as documentos are tools accessed through habilidades search/details/call, not resource servers.';
   if(input.toolID==='bash')output.description=process.platform==='win32'?'Runs bundled PowerShell 7 on Windows. Send readable original commands; the plugin handles routing. Use the python tool with a source string for inline or multiline Python; no shell escaping is needed. Use python -m pip for packages. Prefer read/write/edit for files. workdir selects the working directory; timeout bounds execution.':'Runs Bash on Linux. Use POSIX paths, Linux commands and bundled Python. Do not use PowerShell syntax or Windows drive paths.';
  },
  'experimental.chat.messages.transform':async(_input,output)=>{
   for(const message of output.messages||[])for(const part of message.parts||[]){
    if(part.type!=='tool'||!part.state?.input)continue;
    const args=part.tool==='bash'?part.state.input:/habilidades_call$/.test(part.tool||'')&&part.state.input.name==='start_process'?part.state.input.arguments:null;
    if(args&&typeof args.command==='string')args.command=unwrapCommand(args.command);
   }
  },
  'shell.env':async(_input,output)=>{
   output.env.PYTHONIOENCODING='utf-8';
   output.env.PYTHONUTF8='1';
   output.env.PIP_CACHE_DIR=path.resolve(root,'../dados/pip-cache');
   output.env.PIP_DISABLE_PIP_VERSION_CHECK='1';
   const key=Object.keys(output.env).find(k=>k.toLowerCase()==='path')||'PATH';
   output.env[key]=[...toolBins(root),output.env[key]||process.env.PATH||process.env.Path||''].join(path.delimiter);
  },
  'tool.execute.before':async(input,output)=>{
   if(input.tool==='read_mcp_resource'&&/^(?:file:|[A-Za-z]:[\\/]|\/)/i.test(output.args?.uri||''))throw Error('LOCAL_FILE_NOT_MCP: use the read tool with filePath for a local file. Discover document tools through habilidades search with server=documentos, then details and call. Do not invent a skill path or MCP resource URI.');
   const routed=/habilidades_call$/.test(input.tool||'');
   const activeTool=routed?output.args?.name:input.tool;
   const args=(routed?output.args?.arguments:output.args)||{};
   for(const key of ['filePath','workdir','path'])if(typeof args[key]==='string')args[key]=remap(args[key]);
   if(['read','write','edit'].includes(input.tool)&&typeof args.filePath==='string'){
    const expanded=localPath(args.filePath,directory);if(expanded)args.filePath=expanded;
   }
   if(input.tool==='edit'&&args.filePath&&typeof args.oldString==='string'&&args.oldString){
    try{const original=fs.readFileSync(args.filePath,'utf8');
     if(!original.includes(args.oldString)){
      const ending=original.includes('\r\n')?'\r\n':'\n';
      const normalized=args.oldString.replace(/\r?\n/g,ending);
      if(original.includes(normalized)){args.oldString=normalized;if(typeof args.newString==='string')args.newString=args.newString.replace(/\r?\n/g,ending);}
     }
    }catch{}
   }
   if(/browser_click$/.test(input.tool)&&typeof args.target==='string'){
    const result=await client.session.messages({path:{id:input.sessionID}});
    const messages=result.data??result;
    const snapshots=(Array.isArray(messages)?messages:[]).flatMap(m=>m.parts||[]).filter(p=>p.type==='tool'&&/browser_snapshot$/.test(p.tool)&&p.state?.status==='completed');
    args.target=normalizeTarget(args.target,snapshots.at(-1)?.state.output||'');
   }
   if(activeTool!=='bash'&&!(routed&&activeTool==='start_process'))return;
   let cmd=remap(args.command||'');
   if(/(^|[;|]\s*)\s*(?:exa_|playwright_)[a-z_]+\b/i.test(cmd))throw new Error('FERRAMENTA_NAO_E_COMANDO: invoke the MCP tool through the agent, never as a terminal command.');
   if(/curl|Invoke-WebRequest|requests\.|urllib|httpx\./i.test(cmd)&&urlsIn(cmd).some(u=>rejected.get(input.sessionID)?.has(u)))throw new Error('DOWNLOAD_REPETIDO: this address already returned HTML or a challenge in this session. Use the browser and verify its result, or find another source; do not repeat curl with a different User-Agent.');
   const extraction=cmd.match(/Expand-Archive\s+(?:-Path|-LiteralPath)\s+(?:"([^"]+)"|'([^']+)')/i);
   if(extraction){const f=localPath(extraction[1]||extraction[2],directory);const problem=invalidArtifact(f);if(problem)throw new Error('ARQUIVO_INVALIDO: '+problem);}
   if(process.platform==='win32')cmd=fixQuotedExecutable(cmd);
   args.command=wrapCommand(cmd,path.resolve(root,'..'));
  },
  'tool.execute.after':async(input,output)=>{
   if(['write','edit'].includes(input.tool)&&input.args?.filePath){
    const file=localPath(input.args.filePath,directory);
    const check=await checkSyntax(file,path.resolve(root,'..'));
    const warning=completenessWarning(file);if(warning){output.output=(output.output||'')+'\n'+warning;output.metadata={...output.metadata,contentNeedsReview:true};}
    if(check){output.output=(output.output||'')+'\nVERIFICACAO_AUTOMATICA: '+check.message;output.metadata={...output.metadata,syntaxCheck:check.status};}
    return;
   }
   if(input.tool!=='bash')return;
   const cmd=unwrapCommand(input.args?.command||'');
   output.title=cmd;
   const raw=outputFile(cmd);const file=raw&&localPath(raw,directory);
   const files=[file,...reportedFiles(output.output)].filter(Boolean);
   for(const candidate of new Set([...files,...textArtifactPaths(cmd)])){const warning=completenessWarning(candidate);if(warning){output.output=(output.output||'')+'\n'+warning;output.metadata={...output.metadata,contentNeedsReview:true};break;}}
   const invalid=files.map(f=>({file:f,problem:invalidArtifact(f)})).find(x=>x.problem);
   const problem=invalid?.problem;
   if(problem){
    let set=rejected.get(input.sessionID);if(!set){set=new Set();rejected.set(input.sessionID,set);}for(const url of urlsIn(cmd))set.add(url);
    output.output='DOWNLOAD_INVALIDO: '+problem+'\nFile: '+invalid.file+'\n'+(output.output||'');
    output.metadata={...output.metadata,artifactValid:false};
   }else if(output.metadata?.exit && output.metadata.exit!==0){
    const rawOutput=output.output||'';
    const quoting=/\bpython(?:3|\.exe)?\s+-c\b/i.test(cmd)&&/ScriptBlock should only|SyntaxError|terminator|ParserError|unterminated|Missing (?:file specification|type name|closing)|reserved for future use/i.test(rawOutput);
    output.output='COMANDO_FALHOU (exit '+output.metadata.exit+'): diagnose the error before continuing.\n'+rawOutput;
    if(quoting)output.output+='\nRECUPERACAO_DE_ASPAS: do not repeat the program in python -c. Save Python source in an authorized .py file using write, then execute it. Separate arguments avoid shell quoting conflicts. Check the exit code and actual output.';
   }
  }
 };
};
