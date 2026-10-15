import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { pathToFileURL, fileURLToPath } from "node:url";
const base =
  process.env.AGENTE_LOCAL_HOME ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { launchBrowser } = await import(pathToFileURL(path.join(base, "browser-engine.mjs")));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "mejai-browser-test-"));
const server = http.createServer((request, response) =>
  response.end("<html><body><h1>Local browser test</h1></body></html>"),
);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const original = { ...process.env };
let browser;
try {
  process.env.AGENTE_BROWSER_ENGINE = "camoufox";
  process.env.AGENTE_BROWSER_HEADLESS = "1";
  process.env.AGENTE_TEST_PROFILE = profile;
  delete process.env.AGENTE_BROWSER_PROXY;
  browser = await launchBrowser(base, { engine: "camoufox", humanize: false }, null);
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:" + server.address().port);
  assert.equal(await page.locator("h1").textContent(), "Local browser test");
  await assert.rejects(page.goto("http://blocked-test.onion"), /NS_ERROR|ERR_|blocked/i);
  console.log(
    "PASS real Camoufox headless, local page, clearnet onion blocking; no external navigation.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  for (const name of [
    "AGENTE_BROWSER_ENGINE",
    "AGENTE_BROWSER_HEADLESS",
    "AGENTE_TEST_PROFILE",
    "AGENTE_BROWSER_PROXY",
  ]) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
  const resolved = path.resolve(profile);
  if (
    path.dirname(resolved) === path.resolve(os.tmpdir()) &&
    path.basename(resolved).startsWith("mejai-browser-test-")
  )
    await fs.rm(resolved, { recursive: true, force: true });
}
