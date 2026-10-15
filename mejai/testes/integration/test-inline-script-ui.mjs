import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const base=process.env.AGENTE_LOCAL_HOME || path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const { scriptArtifacts }=await import(pathToFileURL(path.join(base,"src/services/script-artifact-service.mjs")));
const connection=JSON.parse(await fs.readFile(path.join(base,"dados/hub-win32.json")));
const settings=JSON.parse(await fs.readFile(path.join(base,"navegador-config.json")));
const headers={"X-Mejai-Token":connection.token,"Content-Type":"application/json"};
async function api(route,body){const response=await fetch(connection.url+"/api/"+route,{headers,method:body?"POST":"GET",body:body?JSON.stringify(body):undefined});const result=await response.json();assert(response.ok,JSON.stringify(result));return result;}
const fixture=await api("chat",{});
const code='print("script completo")\nprint("``` não encerra o bloco")\n';
const messages=[{info:{id:"msg_write",role:"assistant"},parts:[{id:"part_write",type:"tool",tool:"write",state:{status:"completed",input:{filePath:"/tasks/ready.py",content:code},output:"Written successfully"}}]},{info:{id:"msg_delivered",role:"assistant",finish:"stop",time:{created:Date.now()}},parts:[{type:"text",text:"O script foi salvo em /tasks/ready.py."}]}];
const artifacts=await scriptArtifacts(messages,path.join(base,"tarefas"));
const {chromium}=await import(pathToFileURL(path.join(base,"runtime/browser/node_modules/playwright/index.mjs")));
const browser=await chromium.launch({executablePath:settings.executablePath,headless:true});
try{
  const context=await browser.newContext({permissions:["clipboard-read","clipboard-write"],viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/api/chat/snapshot?**",route=>route.fulfill({json:{sessionID:fixture.id,messages,scriptArtifacts:artifacts,todos:[],status:{type:"idle"},permissions:[],questions:[]}}));
  await page.goto(connection.url+"/#"+connection.token);
  await page.waitForFunction(()=>document.querySelector("#hub-language")?.options.length>0);
  await page.locator("#hub-language").selectOption("en");
  await page.evaluate(id=>localStorage.setItem("mejai-chat-session",id),fixture.id);
  await page.locator("[data-action=chat]").click();
  await page.locator(".script-artifact .code-block").waitFor();
  assert.equal(await page.locator(".script-artifact pre code").textContent(),code);
  await page.locator(".script-artifact").getByRole("button",{name:"Copy code",exact:true}).click();
  assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replaceAll("\r\n","\n"),code);
  await page.waitForTimeout(5200);
  assert.equal(await page.locator(".script-artifact .code-block").count(),1);
  await page.locator("#hub-language").selectOption("pt-BR");
  assert.equal(await page.locator(".script-artifact h4").textContent(),"Script gerado: ready.py");
  assert.equal(await page.locator(".script-artifact pre code").textContent(),code);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(base,"logs/validacao/chat-inline-script.png"),fullPage:true});
  console.log("PASS path-only answer displays full script, exact copy, embedded fences, no duplication after refresh and translated controls; no model inference.");
}finally{await browser.close();await api("chat/delete",{sessionID:fixture.id,confirm:"DELETE"});}
