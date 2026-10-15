import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync,backup} from 'node:sqlite';
import {writeTextAtomic} from './lib/storage.mjs';
const normalize=p=>p.replaceAll('\\','/').replace(/\/$/,'');
export async function relocate(base){
 base=path.resolve(base);const data=path.join(base,'dados');await fs.mkdir(data,{recursive:true});
 const marker=path.join(data,'portabilidade.json');let previous;
 try{previous=JSON.parse(await fs.readFile(marker,'utf8')).base;}catch(e){if(e.code!=='ENOENT')throw e;}
 if(previous&&normalize(previous).toLowerCase()!==normalize(base).toLowerCase()){
  const old=normalize(previous),next=normalize(base);
  const replace=value=>typeof value==='string'&&(normalize(value).toLowerCase()===old.toLowerCase()||normalize(value).toLowerCase().startsWith(old.toLowerCase()+'/'))?next+normalize(value).slice(old.length):value;
  const file=path.join(data,'opencode-data/opencode/opencode.db');let exists=true;try{await fs.access(file);}catch{exists=false;}
  if(exists){
   const db=new DatabaseSync(file);
   try{
    await fs.mkdir(path.join(base,'logs'),{recursive:true});await backup(db,path.join(base,'logs','antes-mover-'+Date.now()+'.db'));
    db.exec('BEGIN IMMEDIATE');
    const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
    for(const table of ['session','session_v2'].filter(t=>tables.has(t))){
     const stmt=db.prepare(`UPDATE ${table} SET directory=?,path=? WHERE id=?`);
     for(const row of db.prepare(`SELECT id,directory,path FROM ${table}`).all()){
      const dir=replace(row.directory);if(dir!==row.directory)stmt.run(dir,dir.replace(/^[a-z]:\//i,''),row.id);
     }
    }
    if(tables.has('project')){
     const stmt=db.prepare('UPDATE project SET worktree=? WHERE id=?');
     for(const row of db.prepare('SELECT id,worktree FROM project').all()){const dir=replace(row.worktree);if(dir!==row.worktree)stmt.run(dir,row.id);}
    }
    db.exec('COMMIT');
   }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}
  }
  // Preserve old references in messages; runtime hooks resolve them against the new root.
  const mappingFile=path.join(base,'caminhos-anteriores.json');let mappings=[];
  try{mappings=JSON.parse(await fs.readFile(mappingFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!mappings.some(x=>normalize(x.from).toLowerCase()===old.toLowerCase()))mappings.push({from:previous,to:'.'});
  await writeTextAtomic(mappingFile,JSON.stringify(mappings,null,2));
 }
 await fs.writeFile(marker+'.tmp',JSON.stringify({base},null,2));await fs.rename(marker+'.tmp',marker);
}
