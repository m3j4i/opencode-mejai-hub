import {pathToFileURL} from 'node:url';
import {runtime,bin,windows} from './platform.mjs';
import fs from 'node:fs/promises';import path from 'node:path';
const {StdioClientTransport}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')));
export async function localTransport(id,s,base,keys,{interactive=false,proxy}={}){
 const home=path.join(base,'dados',windows?'mcp-home':'mcp-home-linux');const temp=path.join(home,'temp');await fs.mkdir(temp,{recursive:true});
 const browser=JSON.parse(await fs.readFile(path.join(base,'navegador-config.json'),'utf8')).executablePath;
 const sub=x=>x.replaceAll('{base}',base).replaceAll('{browser}',browser);
 const env={...process.env,USERPROFILE:home,HOME:home,APPDATA:path.join(home,'AppData/Roaming'),LOCALAPPDATA:path.join(home,'AppData/Local'),TEMP:temp,TMP:temp,XDG_CONFIG_HOME:path.join(home,'.config'),DISABLE_THOUGHT_LOGGING:'true',CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS:'1',MCP_REMOTE_CONFIG_DIR:path.join(base,'dados/oauth',id),GIT_PYTHON_GIT_EXECUTABLE:bin.git};
 const pk=Object.keys(env).find(k=>k.toLowerCase()==='path')||'PATH';env[pk]=[path.dirname(bin.node),path.dirname(bin.python),...(windows?[runtime('git/cmd')]:[]),env[pk]||''].join(path.delimiter);
 for(const [name,key] of Object.entries(s.envKeys||{}))if(keys[key])env[name]=String(keys[key]);
 for(const [name,value] of Object.entries(s.environment||{}))env[name]=sub(value);
 let command=process.execPath,args=[];
 if(s.oauth){args=[runtime('essenciais/node_modules/mcp-remote/dist/proxy.js'),s.url,'--transport','http-only'];}
 else if(s.python){command=bin.python;args=['-m',s.python,...(s.args||[]).map(sub)];}
 else if(s.rootEntry){args=[path.join(base,s.rootEntry),...(s.args||[]).map(sub)];}
 else if(s.entry){args=[runtime('essenciais/node_modules',s.entry),...(s.args||[]).map(sub)];}
 else if(s.commandKey)command=keys[s.commandKey];
 if(proxy){env.AGENTE_BROWSER_PROXY=proxy;env.AGENTE_BROWSER_PROFILE=path.join(base,'dados/tor-browser');env.AGENTE_DOWNLOADS=path.join(base,'downloads/tor');}
 const transport=new StdioClientTransport({command,args,cwd:base,env,stderr:'pipe'});
 if(interactive)transport.stderr?.on('data',b=>process.stderr.write(b));else transport.stderr?.resume();return transport;
}
