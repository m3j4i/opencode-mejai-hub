import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {relocate} from '../../localizar-sessoes.mjs';
const base=await fs.mkdtemp(path.resolve('work/session-relocation-'));const data=path.join(base,'dados');const dbDir=path.join(data,'opencode-data/opencode');await fs.mkdir(dbDir,{recursive:true});
const dbFile=path.join(dbDir,'opencode.db');let db=new DatabaseSync(dbFile);
db.exec("CREATE TABLE session(id TEXT,directory TEXT,path TEXT); CREATE TABLE project(id TEXT,worktree TEXT);");db.prepare('INSERT INTO session VALUES (?,?,?)').run('inside','C:/old/kit/tarefas','old/kit/tarefas');db.prepare('INSERT INTO session VALUES (?,?,?)').run('outside','C:/outro/lugar','outro/lugar');db.prepare('INSERT INTO project VALUES (?,?)').run('project','C:/old/kit/repo');db.close();
await fs.writeFile(path.join(data,'portabilidade.json'),JSON.stringify({base:'C:\\old\\kit'}));
await relocate(base);await relocate(base);db=new DatabaseSync(dbFile);
try{assert.equal(db.prepare("SELECT directory FROM session WHERE id='inside'").get().directory,base.replaceAll('\\','/')+'/tarefas');assert.equal(db.prepare("SELECT directory FROM session WHERE id='outside'").get().directory,'C:/outro/lugar');assert.equal(db.prepare('SELECT worktree FROM project').get().worktree,base.replaceAll('\\','/')+'/repo');}finally{db.close();}
const mappings=JSON.parse(await fs.readFile(path.join(base,'caminhos-anteriores.json'),'utf8'));assert.equal(mappings.length,1);assert.equal(mappings[0].to,'.');console.log('PASS: sessoes e projeto remapeados; caminho externo preservado; reinicio idempotente.');

