import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";

const root = path.resolve(process.argv[2]);
assert.equal(await fs.readFile(path.join(root, ".release-test-fixture"), "utf8"), "disposable");
const expected = "Olá! O chat do pacote está respondendo.";
let completions = 0;
const stub = http.createServer(async (modelRequest, response) => {
  const chunks = [];
  for await (const chunk of modelRequest) chunks.push(chunk);
  response.setHeader("Content-Type", "application/json");
  if (modelRequest.url === "/api/tags")
    return response.end(
      JSON.stringify({ models: [{ name: "release-test:latest", digest: "fixture" }] }),
    );
  if (modelRequest.url === "/api/show")
    return response.end(
      JSON.stringify({
        capabilities: ["completion", "tools"],
        parameters: "num_ctx 32768",
        model_info: { "fixture.context_length": 32768 },
      }),
    );
  if (modelRequest.url === "/api/version") return response.end('{"version":"fixture"}');
  if (modelRequest.url === "/api/ps") return response.end('{"models":[]}');
  if (modelRequest.url === "/v1/chat/completions") {
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    const isTitle = payload.messages.some((message) =>
      JSON.stringify(message.content).includes("You are a title generator"),
    );
    if (!isTitle) completions++;
    const answer = isTitle ? "Teste de saudação" : expected;
    assert.equal(payload.model, "release-test:latest");
    assert(
      payload.messages.some(
        (message) => message.role === "user" && JSON.stringify(message.content).includes("oi"),
      ),
    );
    response.setHeader("Content-Type", "text/event-stream");
    const base = {
      id: "chatcmpl-release",
      object: "chat.completion.chunk",
      created: 1,
      model: payload.model,
    };
    response.write(
      "data: " +
        JSON.stringify({
          ...base,
          choices: [
            { index: 0, delta: { role: "assistant", content: answer }, finish_reason: null },
          ],
        }) +
        "\n\n",
    );
    response.write(
      "data: " +
        JSON.stringify({
          ...base,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        }) +
        "\n\n",
    );
    return response.end("data: [DONE]\n\n");
  }
  response.statusCode = 404;
  response.end('{"error":"Unknown isolated fixture endpoint"}');
});
await new Promise((resolve) => stub.listen(0, "127.0.0.1", resolve));
const runtimeRoot = path.join(root, "runtime", ...(process.platform === "win32" ? [] : ["linux"]));
const node = path.join(
  runtimeRoot,
  process.platform === "win32" ? "node/node.exe" : "node/bin/node",
);
const hub = spawn(node, [path.join(root, "hub.mjs")], {
  cwd: root,
  windowsHide: true,
  stdio: "ignore",
  env: {
    ...process.env,
    MEJAI_NO_BROWSER: "1",
    MEJAI_PREWARM: "0",
    AGENTE_OLLAMA_URL: "http://127.0.0.1:" + stub.address().port,
  },
});
let connection;
let engine;
let sessionID;
async function request(route, payload) {
  const response = await fetch(connection.url + route, {
    method: payload === undefined ? "GET" : "POST",
    headers: { "X-Mejai-Token": connection.token, "Content-Type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: AbortSignal.timeout(120000),
  });
  const text = await response.text();
  assert(response.ok, `${route}: ${response.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}
try {
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      const current = JSON.parse(
        await fs.readFile(path.join(root, "dados", "hub-" + process.platform + ".json"), "utf8"),
      );
      if (current.pid === hub.pid) {
        connection = current;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(connection, "Extracted Hub failed to launch");
  const health = await request("/api/health");
  assert.equal(health.base, root);
  // Maintenance mutations are deliberately serialized by the HTTP layer.
  engine = await request("/api/start", {});
  const config = await fetch(engine.url + "/config", { signal: AbortSignal.timeout(120000) }).then(
    (response) => response.json(),
  );
  assert.equal(config.plugin.length, 6);
  assert(config.plugin.some((entry) => entry.endsWith("/autonomy.mjs")));
  const directory = "?directory=" + encodeURIComponent(path.join(root, "tarefas"));
  assert.deepEqual(
    await fetch(engine.url + "/session" + directory).then((response) => response.json()),
    [],
  );
  sessionID = (await request("/api/chat/send", { text: "oi" })).sessionID;
  assert(sessionID);
  await Promise.all(
    Array.from({ length: 3 }, () => request("/api/chat/snapshot?session=" + sessionID)),
  );
  let snapshot;
  for (let attempt = 0; attempt < 180; attempt++) {
    snapshot = await request("/api/chat/snapshot?session=" + sessionID);
    const text = snapshot.messages
      .filter((message) => message.info.role === "assistant")
      .flatMap((message) => message.parts)
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");
    if (text.includes(expected) && snapshot.status.type === "idle") break;
    const errors = snapshot.messages.map((message) => message.info.error).filter(Boolean);
    assert.deepEqual(errors, [], "Chat returned an engine error");
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert(
    snapshot.messages.some(
      (message) =>
        message.info.role === "assistant" &&
        message.parts.some((part) => part.type === "text" && part.text.includes(expected)),
    ),
    "No assistant answer appeared in chat",
  );
  assert.equal(snapshot.status.type, "idle");
  assert.equal(completions, 1, "One message must not trigger repeated inference");
  for (let index = 0; index < 3; index++) {
    const stable = await request("/api/start", {});
    assert.equal(stable.pid, engine.pid);
    assert.equal(stable.port, engine.port);
    await request("/api/chat/snapshot?session=" + sessionID);
  }
  await request("/api/chat/delete", { sessionID, confirm: "DELETE" });
  sessionID = null;
  console.log(
    JSON.stringify({
      ok: true,
      platform: process.platform,
      completions,
      reply: expected,
      plugins: 6,
      stableProcess: true,
      inference: "isolated local fixture, no real Ollama",
    }),
  );
} finally {
  if (connection && sessionID) await request("/api/chat/stop", { sessionID }).catch(() => {});
  if (connection && sessionID)
    await request("/api/chat/delete", { sessionID, confirm: "DELETE" }).catch(() => {});
  if (connection) await request("/api/stop", {}).catch(() => {});
  if (engine?.pid)
    try {
      process.kill(engine.pid);
    } catch {}
  hub.kill();
  await new Promise((resolve) => stub.close(resolve));
}
