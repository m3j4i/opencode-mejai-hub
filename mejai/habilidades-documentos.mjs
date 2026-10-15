import {runtime,bin,windows} from './platform.mjs';
import {spawn} from 'node:child_process';
import path from 'node:path';
const S={type:'string',minLength:1};
const T=(name,description,properties,required)=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false}});
export const documentTools=[
 T('audit_pdf','Audit a PDF before declaring completion. Counts pages/text/Hebrew glyphs, checks optional section labels and minimum pages, and renders first/middle/last page previews. Open the returned images for visual review. Page counts and labels alone do not prove full source coverage.',{path:S,minimum_pages:{type:'integer',minimum:1},expected_sections:{type:'array',maxItems:200,items:S}},['path']),
 T('read_document',"Read digital PDF, DOCX, XLSX or PPTX with pagination. Does not perform OCR or recalculate formulas. start is zero-based.",{path:S,start:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100},sheet:S},['path']),
 T('create_document',"Create a basic DOCX or PDF with title and paragraphs without overwriting. The basic PDF font supports Latin text; use Python and suitable fonts for Hebrew, RTL or advanced layouts.",{path:S,title:S,paragraphs:{type:'array',maxItems:1000,items:{type:'string'}}},['path','title','paragraphs']),
 T('create_spreadsheet',"Create XLSX rows, headers and filters without overwriting. Text remains literal, including leading equals signs. Use bundled Python/openpyxl for formulas and charts.",{path:S,sheet:S,rows:{type:'array',minItems:1,maxItems:10000,items:{type:'array',maxItems:100,items:{type:['string','number','boolean','null']}}}},['path','rows']),
 T('create_slides',"Create a basic PPTX from slide titles and text without overwriting. Use bundled Python/python-pptx for advanced design.",{path:S,slides:{type:'array',minItems:1,maxItems:100,items:{type:'object',properties:{title:S,text:S},required:['title','text'],additionalProperties:false}}},['path','slides']),
 T('merge_pdf',"Merge local PDFs in the requested order into a new file, preserving originals.",{path:S,sources:{type:'array',minItems:1,maxItems:100,items:S}},['path','sources']),
 T('image_info',"Inspect a local image format, dimensions, frames and structural integrity. Does not interpret its visual meaning.",{path:S},['path']),
 T('convert_image',"Convert a static image to PNG, JPEG or WEBP, optionally reducing dimensions while preserving aspect ratio. JPEG flattens transparency to white. Does not overwrite.",{path:S,source:S,max_width:{type:'integer',minimum:1,maximum:20000},max_height:{type:'integer',minimum:1,maximum:20000}},['path','source']),
];
export function runDocument(name,args,base){
 if(!documentTools.some(t=>t.name===name))throw Error('Unknown tool.');
 return new Promise((resolve,reject)=>{
  const child=spawn(bin.python,[path.join(base,'document-tools.py')],{cwd:base,windowsHide:true,env:{...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'}});
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  let out='',err='',bytes=0,overflow=false;
  const timer=setTimeout(()=>child.kill(),90000);
  child.stdout.on('data',b=>{bytes+=b.length;if(bytes>4e6){overflow=true;child.kill();}else out+=b.toString('utf8');});
  child.stderr.on('data',b=>{err=(err+b.toString('utf8')).slice(-2000);});
  child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('close',code=>{clearTimeout(timer);if(overflow)return reject(Error('Response exceeded 4 MB; reduce limit.'));try{const r=JSON.parse(out);if(code!==0||r.error)reject(Error(r.error||err||'Process interrupted.'));else resolve(r);}catch{reject(Error(err||'Processing was interrupted or exceeded 90 seconds.'));}});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({name,arguments:args}));
 });
}
