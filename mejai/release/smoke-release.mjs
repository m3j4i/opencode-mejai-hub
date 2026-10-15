import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2]);
const run = promisify(execFile);
const windows = process.platform === "win32";
const runtimeRoot = path.join(root, "runtime", ...(windows ? [] : ["linux"]));
const stub = http.createServer((request, response) => {
  assert(
    !request.url.includes("generate") && !request.url.includes("chat"),
    "No inference requests are allowed",
  );
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify(request.url === "/api/version" ? { version: "fixture" } : { models: [] }),
  );
});
await new Promise((resolve) => stub.listen(0, "127.0.0.1", resolve));
const endpoint = "http://127.0.0.1:" + stub.address().port;
const env = {
  ...process.env,
  MEJAI_NO_BROWSER: "1",
  MEJAI_PREWARM: "0",
  AGENTE_OLLAMA_URL: endpoint,
  OPENCODE_DISABLE_AUTOUPDATE: "true",
  OPENCODE_DISABLE_MODELS_FETCH: "true",
};
const node = path.join(runtimeRoot, windows ? "node/node.exe" : "node/bin/node");
const hub = spawn(node, [path.join(root, "hub.mjs")], {
  cwd: root,
  env,
  windowsHide: true,
  stdio: "ignore",
});
let server;
const results = [];
try {
  let connection;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      connection = JSON.parse(
        await fs.readFile(path.join(root, "dados", "hub-" + process.platform + ".json"), "utf8"),
      );
      if (connection.pid === hub.pid) break;
      connection = null;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert(connection, "Hub did not start");
  async function request(route, payload) {
    const response = await fetch(connection.url + route, {
      method: payload ? "POST" : "GET",
      headers: { "X-Mejai-Token": connection.token, "Content-Type": "application/json" },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(90000),
    });
    const text = await response.text();
    assert(response.ok, text);
    return text ? JSON.parse(text) : {};
  }
  const health = await request("/api/health");
  assert.equal(health.base, root);
  for (const asset of ["/", "/chat.js", "/chat/markdown.js", "/vendor/marked.js"])
    assert.equal((await fetch(connection.url + asset)).status, 200);
  results.push("Hub assets and health");
  await request("/api/languages");
  await request("/api/release");
  await request("/api/config?name=LANGUAGE.md");
  results.push("Languages, fork identity and rules editor");
  server = await request("/api/start", {});
  const nativeHealth = await fetch(server.url + "/global/health").then((response) =>
    response.json(),
  );
  assert.equal(nativeHealth.version, "1.18.35-mejai.1");
  const sessions = await fetch(server.url + "/session").then((response) => response.json());
  assert.deepEqual(sessions, []);
  results.push("Native fork starts with zero conversations");
  const tools = await fetch(server.url + "/experimental/tool/ids").then((response) =>
    response.json(),
  );
  assert(tools.includes("python"), "Native Python tool missing");
  results.push("Native Python tool registered");
  await request("/api/stop", {});
  server = null;
  for (const [group, imports] of [
    ["python", "docx,pptx,openpyxl,pypdf,fitz,debugpy"],
    ["ocr", "rapidocr,onnxruntime"],
    ["serena", "serena"],
  ]) {
    const executable = path.join(runtimeRoot, group, windows ? "python.exe" : "bin/python3");
    await run(executable, ["-c", "import " + imports], { timeout: 60000, windowsHide: true, env });
  }
  results.push("Documents, OCR and Serena Python imports");
  const platform = await import(pathToFileURL(path.join(root, "platform.mjs")));
  Object.assign(process.env, platform.environment(root));
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(runtimeRoot, "browsers");
  const { chromium } = await import(
    pathToFileURL(path.join(root, "runtime/browser/node_modules/playwright/index.mjs"))
  );
  const chromiumBrowser = await chromium.launch({ headless: true });
  const page = await chromiumBrowser.newPage();
  await page.goto("data:text/html,<title>mejai-release</title>");
  assert.equal(await page.title(), "mejai-release");
  await chromiumBrowser.close();
  results.push("Bundled Chromium launch without network");
  const originalEnv = { CAMOUFOX_INSTALL_DIR: process.env.CAMOUFOX_INSTALL_DIR };
  const { launchBrowser } = await import(pathToFileURL(path.join(root, "browser-engine.mjs")));
  const browser = await launchBrowser(
    root,
    { engine: "camoufox", headless: true, humanize: false },
    chromium,
  );
  const camoufoxPage = await browser.newPage();
  await camoufoxPage.goto("data:text/html,<title>mejai-camoufox</title>");
  assert.equal(await camoufoxPage.title(), "mejai-camoufox");
  await browser.close();
  if (originalEnv.CAMOUFOX_INSTALL_DIR)
    process.env.CAMOUFOX_INSTALL_DIR = originalEnv.CAMOUFOX_INSTALL_DIR;
  results.push("Bundled Camoufox launch without network");
  console.log(
    JSON.stringify(
      { platform: process.platform, ok: true, results, inference: "disabled; empty local stub" },
      null,
      2,
    ),
  );
} finally {
  if (server?.pid)
    try {
      process.kill(server.pid);
    } catch {}
  hub.kill();
  await new Promise((resolve) => stub.close(resolve));
}
