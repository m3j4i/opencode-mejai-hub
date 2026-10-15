import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const base =
  process.env.AGENTE_LOCAL_HOME ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const connection = JSON.parse(await fs.readFile(path.join(base, "dados/hub-win32.json")));
const headers = { "X-Mejai-Token": connection.token, "Content-Type": "application/json" };

async function hub(route, body) {
  const response = await fetch(connection.url + "/api/" + route, {
    headers,
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  assert(response.ok, JSON.stringify(result));
  return result;
}

const fixture = await hub("chat", {});
try {
  // A valid RGB PNG. Malformed image fixtures are rejected by the native decoder.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGOUm2bEwMDAxAAGAAreAOoNGZ2hAAAAAElFTkSuQmCC",
    "base64",
  );
  const upload = await fetch(
    connection.url + "/api/chat/upload?session=" + fixture.id + "&name=engine-test.png",
    {
      method: "POST",
      headers: { "X-Mejai-Token": connection.token },
      body: png,
      signal: AbortSignal.timeout(15000),
    },
  );
  const uploaded = await upload.json();
  assert(upload.ok, JSON.stringify(uploaded));
  const { readAttachment } = await import(
    pathToFileURL(path.join(base, "src/repositories/attachment-repository.mjs"))
  );
  const attachment = await readAttachment(base, fixture.id, uploaded.id);
  const server = JSON.parse(await fs.readFile(path.join(base, "dados/connection-win32.json")));
  const endpoint =
    "http://127.0.0.1:" +
    server.port +
    "/session/" +
    fixture.id +
    "/message?directory=" +
    encodeURIComponent(path.join(base, "tarefas"));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      noReply: true,
      parts: [
        {
          type: "text",
          text: "Attachment storage fixture.",
          metadata: { mejaiAttachment: { id: uploaded.id, name: uploaded.name } },
        },
        {
          type: "file",
          mime: "image/png",
          filename: uploaded.name,
          url: pathToFileURL(attachment.file).href,
        },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  assert(response.ok, JSON.stringify(result));
  const saved = await hub("chat/snapshot?session=" + fixture.id);
  const parts = saved.messages.flatMap((message) => message.parts);
  assert(parts.some((part) => part.type === "file" && part.mime === "image/png"));
  assert(parts.some((part) => part.metadata?.mejaiAttachment?.id === uploaded.id));
  console.log(
    "PASS native image and attachment metadata persisted; noReply=true, no model inference.",
  );
} finally {
  await hub("chat/delete", { sessionID: fixture.id, confirm: "DELETE" });
  const uploadRoot = path.resolve(base, "tarefas/anexos");
  const fixtureDirectory = path.resolve(uploadRoot, fixture.id);
  if (path.dirname(fixtureDirectory) === uploadRoot && /^ses_[\w-]+$/.test(fixture.id)) {
    await fs.rm(fixtureDirectory, { recursive: true, force: true });
  }
}
