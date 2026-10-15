import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root=process.env.AGENTE_LOCAL_HOME||base;
const {default:execution}=await import(pathToFileURL(path.join(root,'plugins/execution-checks.mjs')));
const hooks=await execution({directory:os.tmpdir()});
for(const uri of ['file:///tmp/example.md','C:\\example.md','/tmp/example.md'])await assert.rejects(hooks['tool.execute.before']({tool:'read_mcp_resource'},{args:{uri}}),/LOCAL_FILE_NOT_MCP/);
await hooks['tool.execute.before']({tool:'read_mcp_resource'},{args:{uri:'docs://official/guide'}});
if(process.platform==='win32'){
 for(const command of ['python -c "print(\\"hello\\")"','python -c "\nprint(1)\n"'])await assert.doesNotReject(hooks['tool.execute.before']({tool:'bash'},{args:{command}}));
 const safe={args:{command:'python example.py'}};await hooks['tool.execute.before']({tool:'bash'},safe);assert.match(safe.args.command,/-EncodedCommand/);
 const command="'Alpha','beta' | grep -i alpha";
 const output=execFileSync(path.join(root,'runtime/powershell/pwsh.exe'),['-NoProfile','-File',path.join(root,'plugins/portable-shell.ps1'),'-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
 assert.match(output,/Alpha/);assert(!output.includes('beta'));
}
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'mejai-review-'));
try{
 await fs.mkdir(path.join(fixture,'plugins'));
 for(const name of ['long-session-core.mjs','autonomy-core.mjs','tor-search-policy.mjs','code-delivery-policy.mjs','assurance.mjs','content-completeness.mjs','execution-core.mjs','portable-shell.mjs'])await fs.copyFile(path.join(root,'plugins',name),path.join(fixture,'plugins',name));
 const {default:assurance}=await import(pathToFileURL(path.join(fixture,'plugins/assurance.mjs')));
 const audit=await assurance({directory:fixture});
 const system={system:[]};await audit['experimental.chat.system.transform']({},system);assert(system.system[0].includes(new Date().toLocaleDateString('en-CA')));
 const messages=[{info:{id:'first',sessionID:'fixture',role:'user'},parts:[{type:'text',text:'Produce the complete collection'}]},{info:{id:'correction',sessionID:'fixture',role:'user'},parts:[{type:'text',text:'Use alternating pages'}]}];
 await audit['experimental.chat.messages.transform']({}, {messages});
 const state=JSON.parse(await fs.readFile(path.join(fixture,'dados/progresso/fixture.json')));
 assert.equal(state.objective,'Produce the complete collection');assert.deepEqual(state.requests,['Produce the complete collection','Use alternating pages']);
 for(let i=0;i<30;i++){messages.push({info:{id:'auto'+i,sessionID:'fixture',role:'user'},parts:[{type:'text',text:'[MEJAI autonomy] Continue'}]});await audit['experimental.chat.messages.transform']({}, {messages});}
 const saved=JSON.parse(await fs.readFile(path.join(fixture,'dados/progresso/fixture.json')));assert.deepEqual(saved.requests,['Produce the complete collection','Use alternating pages']);
 assert.equal(messages.flatMap(m=>m.parts).filter(p=>p.id?.startsWith('mejai-ledger-')).length,1);
 const compact={context:[]};await audit['experimental.session.compacting']({sessionID:'fixture'},compact);assert.match(compact.context[0],/Use alternating pages/);assert.match(compact.context[0],/Produce the complete collection/);
}finally{await fs.rm(fixture,{recursive:true,force:true});}
console.log('PASS: local-resource guidance, safe Python routing, bundled grep, runtime date and original scope retained.');
