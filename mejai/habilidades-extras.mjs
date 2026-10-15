import {runtime,bin,windows} from './platform.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {startTor,stopTor,torStatus,torFetch} from './tor-local.mjs';
const S={type:'string'};const t=(name,description,properties={},required=[])=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false}});
export function extraTools(id){
 if(id==='tor')return [t('start','Start the bundled Tor client on demand. May take time; returns progress without opening sites.'),t('status','Read Tor status; ready only at 100%.'),t('stop','Stop the Tor client started by this router.'),t('fetch','Read HTTP/HTTPS or onion pages through Tor, without direct fallback. Use a discovered or user-provided URL.',{url:S,max_chars:{type:'integer',minimum:100,maximum:50000}},['url'])];
 if(id==='obsidian')return [t('list','List local Markdown vault notes.',{query:S}),t('read','Read a Markdown vault note.',{file:S},['file']),t('write','Create a Markdown note. Set overwrite=true explicitly to replace an existing note.',{file:S,content:S,overwrite:{type:'boolean'}},['file','content']),t('search','Search text in local Markdown notes.',{query:S},['query'])];return [];
}
export async function runExtra(id,name,a,base,keys){
 if(id==='tor'){if(name==='status')return torStatus();if(name==='start')return startTor(base);if(name==='stop')return stopTor();if(name==='fetch')return torFetch(base,a.url,a.max_chars);}
 if(id!=='obsidian')throw Error('Unknown server.');
 const root=path.resolve(base,keys.OBSIDIAN_VAULT||'dados/obsidian-vault');await fs.mkdir(root,{recursive:true});const realRoot=await fs.realpath(root);
 const inside=p=>{const r=path.relative(realRoot,p);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
 if(['read','write'].includes(name)){
  const target=path.resolve(realRoot,a.file);if(!inside(target)||!target.toLowerCase().endsWith('.md'))throw Error('Use a .md file inside the vault.');
  let ancestor=target;while(true){try{const real=await fs.realpath(ancestor);if(!inside(real))throw Error('Link points outside the vault.');break;}catch(e){if(e.code!=='ENOENT')throw e;const parent=path.dirname(ancestor);if(parent===ancestor)throw e;ancestor=parent;}}
  if(name==='read'){const stat=await fs.stat(target);if(stat.size>2e6)throw Error('Note exceeds 2 MB.');return {file:a.file,content:await fs.readFile(target,'utf8')};}
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,a.content,{encoding:'utf8',flag:a.overwrite?'w':'wx'});return {file:a.file,written:true};
 }
 const notes=[];async function walk(dir){for(const ent of await fs.readdir(dir,{withFileTypes:true})){if(notes.length>=1000)return;if(ent.isSymbolicLink()||ent.name.startsWith('.'))continue;const file=path.join(dir,ent.name);if(ent.isDirectory())await walk(file);else if(ent.name.toLowerCase().endsWith('.md'))notes.push(file);}}await walk(realRoot);
 if(name==='list')return {files:notes.map(p=>path.relative(realRoot,p)).filter(p=>!a.query||p.toLowerCase().includes(a.query.toLowerCase())),limit:1000};
 if(name==='search'){const results=[];for(const file of notes){if((await fs.stat(file)).size>2e6)continue;const content=await fs.readFile(file,'utf8');const index=content.toLowerCase().indexOf(a.query.toLowerCase());if(index>=0)results.push({file:path.relative(realRoot,file),excerpt:content.slice(Math.max(0,index-80),index+300)});if(results.length>=50)break;}return {results,limit:50};}
 throw Error('Unknown tool.');
}
