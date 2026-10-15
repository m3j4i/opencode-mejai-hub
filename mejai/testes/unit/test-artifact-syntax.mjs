import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {checkSyntax} from '../../plugins/artifact-syntax.mjs';
const base=process.env.AGENTE_LOCAL_HOME;
const dir=await fs.mkdtemp(path.resolve('work/syntax-test-'));
for(const [name,source,status] of [['return.py','return 42','erro'],['bad.js','const x = ;','erro'],['good.js','throw new Error("NAO EXECUTAR");','ok'],['bad.py','def broken(:\n pass','erro'],['good.py','raise RuntimeError("NAO EXECUTAR")','ok'],['bad.json','{"foo":}','erro'],['good.json','{"ok":true}','ok'],['bad.mjs','export const x = ;','erro'],['good.mjs','throw new Error("NAO EXECUTAR");','ok'],['bom.py','\ufeffprint("olá")','ok']]){
 const file=path.join(dir,name);await fs.writeFile(file,source);const result=await checkSyntax(file,base);assert.equal(result.status,status,JSON.stringify(result));
}
console.log('PASS: sintaxe Python/JSON/JavaScript, BOM e verificacao sem executar o programa.');
const csvFile=path.join(dir,'csv-script.py');await fs.writeFile(csvFile,'import csv\nreader=csv.DictReader([])');
assert((await checkSyntax(csvFile,base)).message.includes('CSV detected'));
console.log('PASS: leitor CSV recebe orientacao de testes negativos sem executar o codigo.');

