import {runtime,bin,windows} from './platform.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
const run=promisify(execFile);
export async function archiveIntegrity(file,base,password){
 if(!/\.(zip|rar|7z|gz|tar)$/i.test(file))return {status:'nao_aplicavel'};
 try{
  await run(bin.seven,['t',file,'-p'+(password??'-'),'-bsp0','-y'],{windowsHide:true,timeout:1200000,maxBuffer:2*1024*1024});
  return {status:'validado',method:'7-Zip t',exitCode:0};
 }catch(error){
  const output=String(error.stdout||'')+'\n'+String(error.stderr||'');
  if(/wrong password|password is incorrect|encrypted archive|enter password/i.test(output))return {status:'senha_necessaria',message:'File received; integrity depends on the correct password. Use browser_verify_file with password.'};
  return {status:'falhou',exitCode:typeof error.code==='number'?error.code:null,message:error.killed?'Verification timed out.':error.code==='ENOENT'?'Bundled 7-Zip was not found.':output.slice(-1800)||error.message};
 }
}
