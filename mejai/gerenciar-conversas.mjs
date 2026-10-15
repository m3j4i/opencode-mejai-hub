import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

export function databases(base){
 const root=fs.realpathSync(base),main=path.join(root,'dados/opencode-data/opencode/opencode.db');
 const found=fs.existsSync(main)?[main]:[];
 const testRoot=path.join(root,'logs','validacao');
 function walk(dir){if(path.resolve(dir).toLowerCase()===testRoot.toLowerCase()||!fs.existsSync(dir)||fs.lstatSync(dir).isSymbolicLink())return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(e.isSymbolicLink())continue;const p=path.join(dir,e.name);
  if(e.isDirectory())walk(p);else if(e.isFile()&&e.name.endsWith('.db'))found.push(p);
 }}
 walk(path.join(root,'logs'));return found;
}
function tables(db){return new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));}
function rows(db){const names=tables(db);return ['session','session_v2'].filter(t=>names.has(t)).flatMap(t=>{const columns=new Set(db.prepare(`PRAGMA table_info(${t})`).all().map(c=>c.name));return db.prepare(`SELECT id,title,parent_id,time_updated ${columns.has('fork_session_id')?',fork_session_id':''} FROM ${t}`).all();});}
export function plan(base,requested=[]){
 const files=databases(base),all=new Map();
 for(const file of files){const db=new DatabaseSync(file,{readOnly:true});try{for(const r of rows(db)){const previous=all.get(r.id);if(!previous||r.time_updated>previous.time_updated)all.set(r.id,r);}}finally{db.close();}}
 const ids=new Set(requested);for(const id of ids)if(!all.has(id))throw Error('Conversation not found: '+id);
 let changed=true;while(changed){changed=false;for(const r of all.values())if((ids.has(r.parent_id)||ids.has(r.fork_session_id))&&!ids.has(r.id)){ids.add(r.id);changed=true;}}
 const sessions=[...all.values()].filter(r=>!requested.length||ids.has(r.id)).sort((a,b)=>b.time_updated-a.time_updated);
 return {files,sessions,ids:[...ids]};
}
export function erase(base,ids){
 if(!ids.length)throw Error('No conversation selected.');
 const p=plan(base,ids);
 // No automatic backup: it would preserve the very conversations being erased.
 for(const file of p.files){
  const db=new DatabaseSync(file);try{
   const names=tables(db);db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; BEGIN IMMEDIATE');
   for(const id of p.ids){
    if(names.has('event'))db.prepare('DELETE FROM event WHERE aggregate_id=?').run(id);
    if(names.has('event_sequence'))db.prepare('DELETE FROM event_sequence WHERE aggregate_id=?').run(id);
    // Explicitly handle both current and legacy storage formats.
    for(const t of ['part','message','todo','session_share','instruction_entry','instruction_state','session_pending','session_message','session_inbox']){
     if(names.has(t))db.prepare(`DELETE FROM ${t} WHERE session_id=?`).run(id);
    }
    for(const t of ['session','session_v2'])if(names.has(t))db.prepare(`DELETE FROM ${t} WHERE id=?`).run(id);
    if(names.has('kv'))db.prepare('DELETE FROM kv WHERE instr(key,?)>0').run(id);
   }
   db.exec('COMMIT; PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE)');
   if(rows(db).some(r=>p.ids.includes(r.id)))throw Error('Verification found a remaining conversation.');
  }catch(e){try{db.exec('ROLLBACK');}catch{}throw Error(path.basename(file)+': '+e.message);}finally{db.close();}
 }
 for(const id of p.ids)if(/^[\w-]{1,120}$/.test(id))fs.rmSync(path.join(base,'dados/progresso',id+'.json'),{force:true});
 try{const statusFile=path.join(base,'dados/progresso/atual.json');if(p.ids.includes(JSON.parse(fs.readFileSync(statusFile,'utf8')).sessionID))fs.rmSync(statusFile,{force:true});}catch(e){if(e.code!=='ENOENT')throw e;}
 return {deleted:p.ids.length,databases:p.files.length};
}
const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){try{
 const base=path.dirname(fileURLToPath(import.meta.url));const action=process.argv[2];
 if(action==='list')console.log(JSON.stringify(plan(base)));
 else if(action==='plan')console.log(JSON.stringify(plan(base,JSON.parse(fs.readFileSync(0,'utf8')))));
 else if(action==='erase'){
  // The GUI owns the idle check, shutdown and human confirmation.
  if(process.env.AGENTE_DELETE_CONFIRMED!=='yes')throw Error('Use the hub or Apagar-conversas.cmd to confirm deletion.');
  console.log(JSON.stringify(erase(base,JSON.parse(fs.readFileSync(0,'utf8')))));
 }else throw Error('Unknown action.');
}catch(e){console.error(e.message);process.exitCode=1;}}
