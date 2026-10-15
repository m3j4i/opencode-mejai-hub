import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {base,bin,environment} from './platform.mjs';
import {readJSON,writeTextAtomic} from './lib/storage.mjs';

const run=promisify(execFile);
const suffix=process.platform==='win32'?'windows-x86_64':'linux-x86_64';
const folder=path.join(base,'runtime/colibri',suffix);
const setupHome=path.join(base,'dados/colibri',process.platform+'-'+process.arch);
const settingsFile=path.join(base,'colibri.json');
const defaults={modelDirectory:'',backend:'cpu',context:16384,output:4096};
export async function settings(){try{return {...defaults,...await readJSON(settingsFile)};}catch(e){if(e.code==='ENOENT')return {...defaults};throw e;}}
export function validateSettings(value){
 const {modelDirectory,backend,context,output}=value;
 if(typeof modelDirectory!=='string'||modelDirectory.includes('\\')||path.posix.isAbsolute(modelDirectory)||modelDirectory.includes(':')||modelDirectory.split('/').some(p=>p==='..'))throw Error('Use a relative model folder inside this kit, with / separators.');
 if(!['cpu','vulkan'].includes(backend))throw Error('Choose CPU or Vulkan.');
 if(!Number.isInteger(context)||context<4096||context>131072)throw Error('Context must be between 4096 and 131072 tokens.');
 if(!Number.isInteger(output)||output<512||output>context/2)throw Error('Output must be between 512 and half the context.');
 return {modelDirectory,backend,context,output};
}
export async function modelPath(value){
 if(!value)throw Error('Colibri is installed. Configure a compatible model folder first.');
 validateSettings({...defaults,modelDirectory:value});
 const root=await fs.realpath(base),resolved=await fs.realpath(path.resolve(base,value));
 const relative=path.relative(root,resolved);
 if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('The model folder must stay inside this kit.');
 if(!(await fs.stat(resolved)).isDirectory())throw Error('Choose a model folder.');
 await fs.access(path.join(resolved,'config.json'));
 return resolved;
}
async function env(){
 const value=environment();await fs.mkdir(setupHome,{recursive:true});
 return {...value,COLI_SETUP_HOME:setupHome,TMPDIR:value.TEMP,PYTHONDONTWRITEBYTECODE:'1'};
}
export async function command(args,timeout=20000){
 if(process.arch!=='x64'||!['win32','linux'].includes(process.platform))throw Error('This Colibri installation supports Windows/Linux x86_64.');
 const result=await run(bin.python,[path.join(folder,'coli'),...args],{cwd:folder,env:await env(),windowsHide:true,timeout,maxBuffer:2000000});
 return result.stdout;
}
export async function state(){
 const config=await settings();
 try{
  await fs.access(path.join(folder,'coli'));const report=JSON.parse(await command(['status','--json']));
  return {installed:true,version:'2.0.0',config,configured:report.configured,server:report.server,install:report.install,modelPending:!config.modelDirectory};
 }catch(error){return {installed:false,config,error:error.message};}
}
export async function save(value){
 const config=validateSettings(value);const current=await state();
 if(['loading','ready'].includes(current.server?.state))throw Error('Stop Colibri before changing its model settings.');
 if(config.modelDirectory)await modelPath(config.modelDirectory);
 await writeTextAtomic(settingsFile,JSON.stringify(config,null,2)+'\n');return config;
}
export async function start(){
 const current=await state();if(!current.installed)throw Error(current.error||'Colibri is not installed.');
 if(['loading','ready'].includes(current.server?.state))return current;
 const config=validateSettings(current.config),model=await modelPath(config.modelDirectory);
 const inspection=await run(bin.python,[path.join(base,'colibri-inspect.py'),folder,model],{env:await env(),windowsHide:true,timeout:15000});
 const metadata=JSON.parse(inspection.stdout);
 if(metadata.modality!=='text')throw Error('Choose a Colibri chat model for MEJAI.');
 if(config.context>metadata.maxContext)throw Error('This model supports at most '+metadata.maxContext+' context tokens.');
 // Recreate OS-specific absolute paths every start: the shared settings stay portable.
 // --model-dir uses existing weights; this action never selects or downloads a model.
 await command(['setup','--yes','--model-dir',model,'--backend',config.backend,'--host','127.0.0.1','--port','18080','--no-start','--reconfigure'],120000);
 const file=path.join(setupHome,'setup.json');const prepared=await readJSON(file);
 prepared.args.push('--ctx',String(config.context),'--ngen',String(config.output));
 prepared.mejai={context:config.context,output:config.output,tools:metadata.tools};
 await writeTextAtomic(file,JSON.stringify(prepared,null,2)+'\n');
 await command(['start','--background','--no-browser'],45000);return state();
}
export async function stop(){
 const current=await state();
 if(!current.configured)return {stopped:true};
 await command(['stop'],30000);
 const after=await state();if(['ready','loading'].includes(after.server?.state))throw Error('Colibri is still running. Inspect its logs.');
 return {stopped:true};
}
export async function logs(){try{return {text:await command(['logs','-n','60'])};}catch(e){return {text:e.message};}}
export async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Colibri HTTP '+r.status);return r.json();}
export function providerFrom(models,config,url){
 if(!Array.isArray(models)||models.length===0)throw Error('Colibri has no available chat model.');
 const entries={};for(const model of models){
  if(typeof model.id!=='string'||!model.id||model.id==='__proto__')continue;
  const caps=model.capabilities||[];
  if(caps.includes('image_generation')||caps.includes('decision')&&!caps.includes('chat'))continue;
  entries[model.id]={name:model.id+' (Colibri)',tool_call:config.tools===true,modalities:{input:model.input_modalities?.includes('image')?['text','image']:['text'],output:['text']},limit:{context:config.context,output:config.output}};
 }
 if(!Object.keys(entries).length)throw Error('The configured Colibri model cannot be used for chat.');
 return {npm:'@ai-sdk/openai-compatible',name:'Local models (Colibri)',options:{baseURL:url,timeout:false,headerTimeout:1800000,chunkTimeout:600000},models:entries};
}
export async function discovered(){
 const current=await state();if(current.server?.state!=='ready')return null;
 const url=current.server.urls?.openai_base_url;
 if(!/^http:\/\/127\.0\.0\.1:\d+\/v1$/.test(url||''))throw Error('Colibri must listen on this computer only.');
 const prepared=await readJSON(path.join(setupHome,'setup.json'));
 if(!prepared.mejai)throw Error('Restart Colibri from this hub to synchronize its context settings.');
 const models=await json(url+'/models');return providerFrom(models.data,prepared.mejai,url);
}
export function emptyProvider(){return {npm:'@ai-sdk/openai-compatible',name:'Local models (Colibri)',options:{baseURL:'http://127.0.0.1:18080/v1',timeout:false,headerTimeout:1800000,chunkTimeout:600000},models:{}};}
export async function sync({configFile,api,initial=false,provider}={}){
 const found=provider===undefined?await discovered():provider;if(!found)return {changed:false};
 const file=configFile||path.join(base,'opencode.json');const original=await fs.readFile(file,'utf8'),config=JSON.parse(original.replace(/^\uFEFF/,''));
 config.provider??={};if(JSON.stringify(config.provider.colibri)===JSON.stringify(found))return {changed:false};
 if(!initial){const states=await json(api+'/session/status');if(Object.values(states).some(s=>s.type!=='idle'))return {changed:false,pending:true};}
 config.provider.colibri=found;config.enabled_providers=[...new Set([...(config.enabled_providers||['ollama']),'colibri'])];
 if(await fs.readFile(file,'utf8')!==original)throw Error('Configuration changed during discovery; retry later.');
 await writeTextAtomic(file,JSON.stringify(config,null,2)+'\n');
 if(!initial)try{await json(api+'/global/dispose',{method:'POST'});}catch(e){await writeTextAtomic(file,original);throw e;}
 return {changed:true};
}
