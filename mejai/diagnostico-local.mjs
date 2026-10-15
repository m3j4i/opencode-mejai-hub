import {bin,windows} from './platform.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {checkSyntax} from './plugins/artifact-syntax.mjs';
import {recoveryCandidate} from './plugins/empty-recovery-core.mjs';
const base=path.dirname(fileURLToPath(import.meta.url)),run=promisify(execFile),checks=[];
async function check(name,fn){try{const detail=await fn();checks.push({name,status:'ok',detail});console.log('[OK] '+name+(detail?' - '+detail:''));}catch(e){checks.push({name,status:'falhou',detail:e.message});console.log('[FAIL] '+name+' - '+e.message);}}
console.log('Local kit diagnostics. Does not start models or modify conversations.\n');
await check('Bundled Node',async()=>process.version);
await check('Bundled Python',async()=>(await run(bin.python,['-I','--version'],{windowsHide:true,timeout:10000})).stdout.trim());
await check('Platform shell',async()=>(await run(bin.shell,windows?['-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.ToString()']:['--version'],{windowsHide:true,timeout:10000})).stdout.trim());
await check('Configuration and plugins',async()=>{
 const config=JSON.parse(await fs.readFile(path.join(base,'opencode.json'),'utf8'));
 assert(config.mcp?.habilidades,'On-demand tool router is missing');
 const catalog=JSON.parse(await fs.readFile(path.join(base,'mcp-catalogo.json'),'utf8'));assert(catalog.navegador,'Browser adapter is missing');
 // The root configuration may contain paths from the other OS. Shared
 // preparation relocates these five bundled plugins for the active platform.
 const bundled=new Set(['url-evidence.mjs','execution-checks.mjs','empty-recovery.mjs','assurance.mjs','http-retry.mjs']);
 for(const item of config.plugin||[]){const resolved=item.startsWith('file:')?fileURLToPath(item):item;const name=resolved.replaceAll('\\','/').split('/').at(-1);await fs.access(bundled.has(name)?path.join(base,'plugins',name):path.resolve(base,resolved));}
 return (config.plugin||[]).length+' plugins found';
});
await check('Empty-response detection and continuation limits',async()=>{
 const user={info:{role:'user'},parts:[{type:'text',text:'teste'}]},empty={info:{role:'assistant',finish:'stop'},parts:[]};
 assert(recoveryCandidate([user,empty]));
 const retry={info:{role:'user'},parts:[{type:'text',text:'[Recuperacao automatica de resposta vazia] teste'}]};
 assert(!recoveryCandidate([user,empty,retry,empty,retry,empty]));
 assert(!recoveryCandidate([user,{...empty,parts:[{type:'text',text:'Concluido.'}]}]));
});
await fs.mkdir(path.join(base,'dados/diagnostico'),{recursive:true});
const temp=await fs.mkdtemp(path.join(base,'dados/diagnostico/teste-'));
for(const [name,source,expected] of [['valido.py','raise RuntimeError("nao executar")','ok'],['invalido.py','return 42','erro'],['invalido.js','const x = ;','erro'],['valido.json','{"teste":true}','ok']]){
 await check('Validator: '+name,async()=>{const file=path.join(temp,name);await fs.writeFile(file,source);const result=await checkSyntax(file,base);assert.equal(result.status,expected,result.message);});
}
// Only the exact temporary files created by this run are removed.
for(const name of ['valido.py','invalido.py','invalido.js','valido.json'])await fs.unlink(path.join(temp,name)).catch(()=>{});
await fs.rmdir(temp).catch(()=>{});
await fs.mkdir(path.join(base,'logs'),{recursive:true});
const report=path.join(base,'logs/diagnostico-ultimo.json');
await fs.writeFile(report,JSON.stringify({time:new Date().toISOString(),checks,scope:'Local checks only. Does not verify model quality, external sites or MCP authentication.'},null,2));
console.log('\nReport: '+report+'\nThis local test does not verify external sites or AI response quality.');
process.exitCode=checks.some(c=>c.status==='falhou')?1:0;
