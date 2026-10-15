import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {plan,erase} from '../../gerenciar-conversas.mjs';
const base=fs.mkdtempSync(path.join(os.tmpdir(),'session-cleanup-test-'));
fs.mkdirSync(path.join(base,'dados/opencode-data/opencode'),{recursive:true});fs.mkdirSync(path.join(base,'logs'));
const files=[path.join(base,'dados/opencode-data/opencode/opencode.db'),path.join(base,'logs/old.db')];
// Test fixtures are not real conversation backups and must never enter the plan.
const fixtureDir=path.join(base,'logs/validacao/work/nested/logs');fs.mkdirSync(fixtureDir,{recursive:true});
const fixtureFile=path.join(fixtureDir,'opencode.db');const fixtureDb=new DatabaseSync(fixtureFile);
fixtureDb.exec('CREATE TABLE session_v2(id TEXT PRIMARY KEY,directory TEXT,path TEXT); INSERT INTO session_v2 VALUES (\'ses_fake\',\'x\',\'y\');');fixtureDb.close();
const fixtureBefore=fs.readFileSync(fixtureFile);
for(const file of files){const db=new DatabaseSync(file);db.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE session(id TEXT PRIMARY KEY,title TEXT,parent_id TEXT,time_updated INTEGER);
CREATE TABLE session_v2(id TEXT PRIMARY KEY,title TEXT,parent_id TEXT,fork_session_id TEXT,time_updated INTEGER);
CREATE TABLE message(id TEXT,session_id TEXT,data TEXT);
CREATE TABLE part(id TEXT,session_id TEXT,data TEXT);
CREATE TABLE event(aggregate_id TEXT,data TEXT);
CREATE TABLE event_sequence(aggregate_id TEXT);
CREATE TABLE kv(key TEXT,value TEXT);
CREATE TABLE credential(id TEXT,value TEXT);
INSERT INTO session VALUES ('ses_old','Old',NULL,1),('ses_keep','Keep',NULL,2);
INSERT INTO session_v2 VALUES ('ses_child','Child','ses_old',NULL,3),('ses_fork','Fork',NULL,'ses_old',4);
INSERT INTO credential VALUES ('token','unchanged');
`);
for(const id of ['ses_old','ses_child','ses_fork','ses_keep']){const data=id==='ses_keep'?'KEEP-MESSAGE':'ERASE-SECRET-MARKER';db.prepare('INSERT INTO message VALUES (?,?,?)').run(id,id,data);db.prepare('INSERT INTO part VALUES (?,?,?)').run(id,id,data);db.prepare('INSERT INTO event VALUES (?,?)').run(id,data);db.prepare('INSERT INTO event_sequence VALUES (?)').run(id);db.prepare('INSERT INTO kv VALUES (?,?)').run('diff-'+id,data);}
db.close();}
assert.equal(plan(base).sessions.length,4);assert.deepEqual(new Set(plan(base,['ses_old']).ids),new Set(['ses_old','ses_child','ses_fork']));
const before=fs.readFileSync(files[0]);assert.throws(()=>erase(base,['nonexistent']));assert.deepEqual(fs.readFileSync(files[0]),before);
const result=erase(base,['ses_old']);assert.equal(result.deleted,3);assert.equal(result.databases,2);
assert.deepEqual(fs.readFileSync(fixtureFile),fixtureBefore);
for(const file of files){const db=new DatabaseSync(file,{readOnly:true});assert.equal(db.prepare('SELECT count(*) n FROM session').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM session_v2').get().n,0);for(const table of ['message','part','event','event_sequence','kv'])assert.equal(db.prepare('SELECT count(*) n FROM '+table).get().n,1);assert.equal(db.prepare('SELECT value FROM credential').get().value,'unchanged');assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');db.close();assert(!fs.readFileSync(file).includes(Buffer.from('ERASE-SECRET-MARKER')));}
console.log('PASS: selection, descendants/forks, old backup, message/part/event cleanup, secure compaction, retained conversation/credentials, invalid selection. No real sessions changed.');
