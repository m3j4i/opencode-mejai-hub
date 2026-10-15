import {runtime,bin,windows} from './platform.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import net from 'node:net';import http from 'node:http';import https from 'node:https';import {spawn} from 'node:child_process';import {createRequire} from 'node:module';
const require=createRequire(runtime('essenciais/package.json'));
let child,starting,ready=false,progress=0,port=0,lastError='';
export function torStatus(){return {running:!!child,ready,progress,proxy:child?'socks5h://127.0.0.1:'+port:null,error:lastError||undefined};}
export async function startTor(base){
 if(child)return torStatus();if(starting)return starting;
 starting=(async()=>{
  const listener=net.createServer();await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve);});port=listener.address().port;await new Promise(r=>listener.close(r));
  const data=path.join(base,'dados/tor');await fs.mkdir(data,{recursive:true});ready=false;progress=0;lastError='';
  const args=['--ClientOnly','1','--SocksPort','127.0.0.1:'+port,'--DataDirectory',data,'--GeoIPFile',runtime('tor/data/geoip'),'--GeoIPv6File',runtime('tor/data/geoip6'),'--AvoidDiskWrites','1','--Log','notice stdout'];
  child=spawn(bin.tor,args,{cwd:runtime('tor'),stdio:['ignore','pipe','pipe'],windowsHide:true});
  let pending='';const log=b=>{pending+=b;const lines=pending.split(/\r?\n/);pending=lines.pop();for(const line of lines){const m=line.match(/Bootstrapped (\d+)%/);if(m){progress=Number(m[1]);ready=progress===100;}if(/\[err\]/.test(line))lastError=line.slice(0,500);}};
  child.stdout.on('data',log);child.stderr.on('data',log);child.on('error',e=>{lastError=e.message;child=undefined;ready=false;});child.on('exit',code=>{child=undefined;ready=false;if(code&&!lastError)lastError='Tor exited with code '+code;});return torStatus();
 })();try{return await starting;}finally{starting=undefined;}
}
export async function readyTor(base){await startTor(base);const until=Date.now()+90000;while(child&&!ready&&Date.now()<until)await new Promise(r=>setTimeout(r,300));if(!ready)throw Error(lastError||'Tor is still connecting. Check tor.status and retry later; never fall back to a direct connection.');return 'socks5://127.0.0.1:'+port;}
export async function stopTor(){const p=child;if(p){await new Promise(resolve=>{p.once('exit',resolve);p.kill();setTimeout(resolve,3000).unref();});}return torStatus();}
export async function torFetch(base,address,maxChars=20000,redirects=0){
 await readyTor(base);const url=new URL(address);if(!['http:','https:'].includes(url.protocol))throw Error('Tor fetch accepts HTTP/HTTPS.');if(redirects>5)throw Error('Too many redirects.');
 const {SocksProxyAgent}=require('socks-proxy-agent');const agent=new SocksProxyAgent('socks5h://127.0.0.1:'+port);
 const response=await new Promise((resolve,reject)=>{const request=(url.protocol==='https:'?https:http).get(url,{agent,headers:{'User-Agent':'AgenteLocal-Tor/1.0','Accept':'text/html,application/json,text/plain'},timeout:45000},r=>{const chunks=[];let bytes=0;r.on('data',b=>{bytes+=b.length;if(bytes>4e6){r.destroy(Error('Response exceeds 4 MB. Use the Tor browser adapter for files.'));return;}chunks.push(b);});r.on('error',reject);r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body:Buffer.concat(chunks).toString('utf8')}));});request.on('timeout',()=>request.destroy(Error('Tor timed out; no direct connection was attempted.')));request.on('error',reject);}).finally(()=>agent.destroy());
 if(response.status>=300&&response.status<400&&response.headers.location)return torFetch(base,new URL(response.headers.location,url).href,maxChars,redirects+1);
 if(response.status>=400)throw Error('Tor HTTP '+response.status);
 if(!/text|json|xml|html/.test(response.headers['content-type']||''))throw Error('Binary content: use tor-browser.');
 let text=response.body,links=[];
 if(/html/.test(response.headers['content-type']||'')){const {parseHTML}=require('linkedom');const {document}=parseHTML(text);document.querySelectorAll('script,style,noscript').forEach(x=>x.remove());links=[...document.querySelectorAll('a[href]')].slice(0,100).flatMap(x=>{try{const u=new URL(x.getAttribute('href'),url);return /^https?:$/.test(u.protocol)?[{text:x.textContent.slice(0,100),url:u.href}]:[];}catch{return [];}});text=document.body.textContent;}
 return {url:url.href,via:'Tor SOCKS5 with remote DNS',status:response.status,text:text.slice(0,Math.max(100,Math.min(50000,maxChars))),links};
}
