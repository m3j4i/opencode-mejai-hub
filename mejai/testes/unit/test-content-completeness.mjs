import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const base=process.env.AGENTE_LOCAL_HOME;
const {completenessWarning,textArtifactPaths}=await import(pathToFileURL(path.join(base,'plugins/content-completeness.mjs')));
const {default:plugin}=await import(pathToFileURL(path.join(base,'plugins/execution-checks.mjs')));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kit-content-'));
try{
 const file=path.join(temp,'sample.txt');
 fs.writeFileSync(file,'Relatório completo, sem omissões.');assert.equal(completenessWarning(file),null);
 fs.writeFileSync(file,'Primeiro item...');assert.match(completenessWarning(file),/CONFERENCIA/);
 const hooks=await plugin({client:{},directory:temp});
 const output={output:'Saved',metadata:{existing:true}};
 await hooks['tool.execute.after']({tool:'write',args:{filePath:file}},output);
 assert.match(output.output,/Saved.*\nCONFERENCIA/s);assert.equal(output.metadata.contentNeedsReview,true);assert.equal(output.metadata.existing,true);
 assert.deepEqual(textArtifactPaths(`Get-Content "${file}"`),[]);
 const shellOutput={output:'',metadata:{exit:0}};
 await hooks['tool.execute.after']({tool:'bash',args:{command:`Set-Content -LiteralPath "${file}" -Value 'Primeiro item...'`}},shellOutput);
 assert.equal(shellOutput.metadata.contentNeedsReview,true);
 fs.writeFileSync(file,'[TODO]');assert.ok(completenessWarning(file));
 fs.writeFileSync(file,'a'.repeat(1024*1024+1));assert.equal(completenessWarning(file),null);
 assert.equal(completenessWarning(path.join(temp,'missing.txt')),null);
 const code=path.join(temp,'code.js');fs.writeFileSync(code,'// ...');assert.equal(completenessWarning(code),null);
 console.log('OK: conteúdo normal, omissões, hook, metadados e limites.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
