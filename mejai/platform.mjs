import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export const base=path.dirname(fileURLToPath(import.meta.url));
export const windows=process.platform==='win32';
const shared=new Set(['browser','serena-lsp']);
export const runtime=(...parts)=>path.join(base,'runtime',...(windows||shared.has(parts.join('/').split('/')[0])?[]:['linux']),...parts);
export const bin={node:windows?runtime('node/node.exe'):runtime('node/bin/node'),python:windows?runtime('python/python.exe'):runtime('python/bin/python3'),ocr:windows?runtime('ocr/python.exe'):runtime('ocr/bin/python3'),serena:windows?runtime('serena/python.exe'):runtime('serena/bin/python3'),opencode:windows?runtime('opencode.exe'):runtime('opencode'),git:windows?runtime('git/cmd/git.exe'):'git',shell:windows?runtime('powershell/pwsh.exe'):'/bin/bash',seven:windows?path.join(base,'ferramentas/7zip/bin/7z.exe'):runtime('tools/7zz'),tor:windows?runtime('tor/tor/tor.exe'):runtime('tor/tor/tor')};
export function environment(root=base){
 const data=path.join(root,'dados');const env={...process.env,AGENTE_LOCAL_HOME:root,OPENCODE_CONFIG:path.join(root,'opencode.json'),OPENCODE_DISABLE_AUTOUPDATE:'true',OPENCODE_DISABLE_MODELS_FETCH:'true',PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',PIP_DISABLE_PIP_VERSION_CHECK:'1'};
 for(const [key,value] of Object.entries({XDG_CONFIG_HOME:'opencode-config',XDG_DATA_HOME:'opencode-data',XDG_CACHE_HOME:'opencode-cache',XDG_STATE_HOME:'opencode-state',TEMP:'temporarios',TMP:'temporarios',npm_config_cache:'npm-cache',PIP_CACHE_DIR:'pip-cache'})){env[key]=path.join(data,value);fs.mkdirSync(env[key],{recursive:true});}
 const pk=Object.keys(env).find(k=>k.toLowerCase()==='path')||'PATH';env[pk]=[path.dirname(bin.node),path.dirname(bin.python),...(windows?[runtime('git/cmd')]:[runtime('tools')]),env[pk]||''].join(path.delimiter);
 if(!windows){const triplet=process.arch==='arm64'?'aarch64-linux-gnu':'x86_64-linux-gnu';env.LD_LIBRARY_PATH=[runtime('system-libs/usr/lib',triplet),runtime('system-libs/lib',triplet),env.LD_LIBRARY_PATH||''].filter(Boolean).join(':');}
 return env;
}
