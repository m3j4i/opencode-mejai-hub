import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
export async function checkSyntax(file,base){
 const extension=path.extname(file||'').toLowerCase();
 if(!['.py','.json','.js','.mjs','.cjs'].includes(extension))return null;
 try{
  const stat=fs.statSync(file);if(!stat.isFile()||stat.size>2*1024*1024)return null;
  if(extension==='.json')JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  else{
   const executable=path.join(base,'runtime',...(process.platform==='win32'?[]:['linux']),extension==='.py'?(process.platform==='win32'?'python/python.exe':'python/bin/python3'):(process.platform==='win32'?'node/node.exe':'node/bin/node'));
   const args=extension==='.py'?['-I','-c',"import sys,tokenize; p=sys.argv[1]; f=tokenize.open(p); s=f.read(); f.close(); compile(s, p, 'exec', dont_inherit=True)",file]:['--check',file];
   await run(executable,args,{timeout:5000,windowsHide:true,maxBuffer:32000});
  }
  const source=fs.readFileSync(file,'utf8');
  const csvAdvice=/csv\.(DictReader|reader)\s*\(/.test(source)?' CSV detected: test missing fields, incorrect headers, invalid values and NaN/Infinity. Verify nonzero failure exit codes and absence of partial JSON. Confirm that errors preserve existing outputs. Never claim these cases pass without running them.':'';
  return {status:'ok',message:'Syntax is valid. This does not verify dependencies or behavior; run relevant functional checks before completing.'+csvAdvice};
 }catch(error){
  if(error.code==='ENOENT'||error.killed)return {status:'nao_verificado',message:'Verification was unavailable or exceeded five seconds. Check manually before completing.'};
  const detail=String(error.stderr||error.message).slice(0,3000);
  return {status:'erro',message:'Fix the file before claiming completion. The file was saved, but syntax verification failed:\n'+detail};
 }
}
