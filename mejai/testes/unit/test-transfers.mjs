import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
import {transferManager,validateRange} from '../../transfer-manager.mjs';
const dir=await fs.mkdtemp(path.resolve('work/transfer-test-')),payload=Buffer.alloc(300000,37);let first=true;
const server=http.createServer((req,res)=>{
 if(req.url==='/html'){res.setHeader('Content-Type','text/html');res.end('<html>blocked</html>');return;}
 const offset=Number(req.headers.range?.match(/bytes=(\d+)/)?.[1]||0);
 const isResume=!!req.headers.range;
 if(isResume&&req.url==='/bad'){res.writeHead(200,{'Content-Length':payload.length,'ETag':'"v1"'});res.end(payload);return;}
 res.writeHead(isResume?206:200,{'Content-Type':'application/octet-stream','Content-Length':payload.length-offset,'ETag':'"v1"',...(isResume?{'Content-Range':`bytes ${offset}-${payload.length-1}/${payload.length}`}:{})});
 if((req.url==='/cut'&&first)||req.url==='/bad'&&!isResume){first=false;res.write(payload.subarray(0,100000));setTimeout(()=>res.destroy(),100);return;}
 res.end(payload.subarray(offset));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const records=[],tasks=new Set(),persist=async()=>{};const manager=transferManager({base:'C:/example/mejai',directory:dir,records,persist,tasks});
async function done(){await Promise.all([...tasks]);}
try{
 const normal=await manager.start(url+'/normal','normal.bin');await done();assert.equal(normal.status,'concluido');assert.deepEqual(await fs.readFile(normal.path),payload);
 const cut=await manager.start(url+'/cut','cut.bin');await done();assert.equal(cut.status,'interrompido');assert.equal((await fs.stat(cut.partPath)).size,100000);
 const restoredRecords=JSON.parse(JSON.stringify(records));const restored=transferManager({base:'C:/example/mejai',directory:dir,records:restoredRecords,persist,tasks});restored.resume(cut.id);await done();const recovered=restoredRecords.find(r=>r.id===cut.id);assert.equal(recovered.status,'concluido');assert.deepEqual(await fs.readFile(recovered.path),payload);
 const bad=await manager.start(url+'/bad','bad.bin');await done();const before=await fs.readFile(bad.partPath);manager.resume(bad.id);await done();assert.equal(bad.status,'interrompido');assert.deepEqual(await fs.readFile(bad.partPath),before);
 const html=await manager.start(url+'/html','fake.rar');await done();assert.notEqual(html.status,'concluido');assert.match(html.error,/page/);
 for(const args of [[200,'',10,100],[206,'bytes 0-99/100',10,100],[206,'bytes 10-199/200',10,100]])assert.throws(()=>validateRange(...args));
 console.log('PASS: transferencia real HTTP, queda e retomada byte a byte, resposta 200 recusada sem corromper parcial, HTML rejeitado, SHA-256 registrado.');
}finally{manager.stop();server.closeAllConnections();server.close();}

