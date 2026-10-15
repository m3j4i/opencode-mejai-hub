import fs from 'node:fs';
import path from 'node:path';
export function toolBins(root,depth=0){
 if(depth>5||!fs.existsSync(root))return [];
 return fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.isSymbolicLink()).flatMap(e=>e.name==='bin'?[path.join(root,e.name)]:toolBins(path.join(root,e.name),depth+1));
}
export function localPath(value,cwd){
 value=value.replace(/\$env:([a-z_][a-z0-9_]*)/gi,(full,key)=>process.env[Object.keys(process.env).find(k=>k.toLowerCase()===key.toLowerCase())]||full).replace(/\$HOME\b/g,(process.platform==='win32'?process.env.USERPROFILE:process.env.HOME)||'');
 if(value.includes('$'))return null;
 return path.resolve(cwd,value);
}
export function outputFile(command){
 const m=command.match(/(?:\s-o\s+|\s--output\s+|\s-OutFile\s+)(?:"([^"]+)"|'([^']+)'|([^\s;|]+))/i);
 return m&&(m[1]||m[2]||m[3]);
}
export function invalidArtifact(file,extension){
 if(!file||!fs.existsSync(file))return null;
 const ext=(extension||path.extname(file)).toLowerCase();
 if(!['.zip','.rar','.7z','.gz','.tar','.iso','.srt','.bin'].includes(ext))return null;
 const fd=fs.openSync(file,'r');const buf=Buffer.alloc(8192);let n;try{n=fs.readSync(fd,buf,0,buf.length,0);}finally{fs.closeSync(fd);}
 if(n===0)return 'Empty file: download is not verified.';
 const head=buf.subarray(0,n);const text=head.toString('utf8').replace(/^\uFEFF/,'').trimStart();
 if(/^<!doctype\s+html|^<html|<title>Just a moment|challenges\.cloudflare\.com|cf-chl-/i.test(text))return 'The file contains HTML or an access challenge. Use the browser with the verified source and optional human assistance; do not extract or claim success.';
 if(ext==='.zip'&&!(head[0]===0x50&&head[1]===0x4b&&[[3,4],[5,6],[7,8]].some(([a,b])=>head[2]===a&&head[3]===b)))return 'ZIP signature missing. Verify the actual format before extraction. Small size alone does not prove invalidity.';
 if(ext==='.rar'&&!(head.subarray(0,7).equals(Buffer.from('526172211a0700','hex'))||head.subarray(0,8).equals(Buffer.from('526172211a070100','hex'))))return 'RAR signature missing. Do not extract or claim success.';
 if(ext==='.7z'&&!head.subarray(0,6).equals(Buffer.from('377abcaf271c','hex')))return '7z signature missing. Do not extract or claim success.';
 if(ext==='.gz'&&!(head[0]===0x1f&&head[1]===0x8b))return 'GZIP signature missing. Do not extract or claim success.';
 return null;
}
export function reportedFiles(output){
 const found=String(output||'').match(/[A-Za-z]:[\\/][^\r\n"<>|]*?\.(?:zip|rar|7z|gz|tar|iso|srt|bin)(?=$|[\s"',)])/gi)||[];
 return [...new Set(found)].filter(f=>{try{return fs.statSync(f).isFile();}catch{return false;}}).slice(0,10);
}
export function fixQuotedExecutable(command){return command.replace(/^(\s*)(["'][^\r\n"']+\.exe["'])\s+(?=-)/i,'$1& $2 ');}
export function normalizeTarget(target,snapshot){
 if(/^https?:\/\//i.test(target))throw new Error('ALVO_INVALIDO: a URL is not a click target. Read browser_snapshot and use the real element reference, such as e118 or f3e118. Use browser_navigate to open a page.');
 const ref=target.match(/\b(?:f\d+)?e\d+\b/)?.[0];
 if(ref&&snapshot.includes('[ref='+ref+']'))return ref;
 return target;
}
