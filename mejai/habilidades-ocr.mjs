import {runtime,bin,windows} from './platform.mjs';
import path from 'node:path';
import {spawn} from 'node:child_process';
export const ocrTools=[{name:'read_ocr',description:"Extract text from local images or scanned PDFs using CPU OCR. start is zero-based; process up to three pages per call and use next to continue. Preserve the source and verify important values against the image.",inputSchema:{type:'object',properties:{path:{type:'string',minLength:1},start:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:3}},required:['path'],additionalProperties:false}}];
export function runOCR(name,args,base){
 if(name!=='read_ocr')throw Error('Unknown OCR tool.');
 return new Promise((resolve,reject)=>{
  const child=spawn(bin.ocr,[path.join(base,'ocr-tools.py')],{cwd:base,windowsHide:true,env:{...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',PYTHONNOUSERSITE:'1'}});
  let out='',err='',overflow=false;
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',b=>{out+=b;if(out.length>500000){overflow=true;child.kill();}});
  child.stderr.on('data',b=>{err=(err+b).slice(-2000);});
  const timer=setTimeout(()=>child.kill(),110000);
  child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('close',code=>{clearTimeout(timer);if(overflow)return reject(Error('OCR output is too large.'));try{const r=JSON.parse(out);if(code!==0||r.error)reject(Error(r.error||err));else resolve(r);}catch{reject(Error('OCR was interrupted or exceeded 110 seconds. Try one page. '+err));}});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(args));
 });
}
