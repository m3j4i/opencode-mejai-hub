import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Pass a disposable kit with real bundled runtimes, never a user's installation.
const root = path.resolve(process.argv[2]);
assert.equal(await fs.readFile(path.join(root, ".startup-test-fixture"), "utf8"), "disposable");
const stub = http.createServer((request, response) => {
  assert(!/generate|chat/.test(request.url), "No inference allowed");
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ models: [] }));
});
await new Promise((resolve) => stub.listen(0, "127.0.0.1", resolve));
process.env.AGENTE_OLLAMA_URL = "http://127.0.0.1:" + stub.address().port;
process.env.MEJAI_PREWARM = "0";
const { start, stop, api } = await import(pathToFileURL(path.join(root, "mejai-controller.mjs")));
const { snapshot } = await import(pathToFileURL(path.join(root, "chat-api.mjs")));
let server;
try {
  const results = await Promise.all([start(), start(), start()]);
  server = results[0];
  assert(results.every((item) => item.pid === server.pid && item.port === server.port));
  const response = await fetch(server.url + "/config", { signal: AbortSignal.timeout(120000) });
  assert(response.ok);
  const config = await response.json();
  assert(config.plugin.some((entry) => entry.endsWith("/autonomy.mjs")));
  assert.equal(config.plugin.length, 6);
  const query = "?directory=" + encodeURIComponent(path.join(root, "tarefas"));
  const session = await api(server.url + "/session" + query, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  for (let index = 0; index < 3; index++) {
    const current = await snapshot(session.id);
    assert.equal(current.status.type, "idle");
    const running = await start();
    assert.equal(running.pid, server.pid);
    assert.equal(running.port, server.port);
  }
  await api(server.url + "/session/" + session.id + query, { method: "DELETE" });
  console.log(
    "PASS real engine: old empty plugins restored, concurrent startup and repeated chat polls retain one PID/port; no inference.",
  );
} finally {
  try {
    await stop();
  } finally {
    if (server?.pid) {
      try {
        process.kill(server.pid);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
  }
  await new Promise((resolve) => stub.close(resolve));
}
