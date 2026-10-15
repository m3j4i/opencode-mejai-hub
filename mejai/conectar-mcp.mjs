import {pathToFileURL} from 'node:url';
import {runtime,bin,windows} from './platform.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createInterface} from 'node:readline/promises';
const {Client}=await import(pathToFileURL(runtime('browser/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')));import {localTransport} from './mcp-transport.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));const catalog=JSON.parse(await fs.readFile(path.join(base,'mcp-catalogo.json'),'utf8'));const choices=Object.keys(catalog).filter(k=>catalog[k].oauth);
const input=createInterface({input:process.stdin,output:process.stdout});let client;
try{
 console.log('Connect an account to MEJAI. Authorize only your own account in the browser.');console.log(choices.map((id,i)=>(i+1)+'. '+id).join('\n'));
 const choice=process.argv[2]||await input.question('Service number or name (Enter cancels): ');if(!choice)process.exit(0);const id=choices[Number(choice)-1]||choice;if(!choices.includes(id))throw Error('Service is not listed.');
 const file=path.join(base,'dados/conexoes.json');let keys={};try{keys=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const transport=await localTransport(id,catalog[id],base,keys,{interactive:true});client=new Client({name:'agente-local',version:'1.0'});console.log('Waiting for authentication in the browser...');await client.connect(transport,{timeout:300000});await client.listTools();
 // Re-read before writing so editing another credential during login does not lose it.
 try{keys=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 keys[id.toUpperCase().replaceAll('-','_')+'_CONNECTED']=true;await fs.writeFile(file,JSON.stringify(keys,null,2));console.log('Connected. The agent can use '+id+' on demand.');
}catch(e){console.error('Connection was not completed: '+e.message);process.exitCode=1;}finally{await client?.close().catch(()=>{});input.close();}
