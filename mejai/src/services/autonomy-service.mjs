import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { base } from "../../platform.mjs";
import { api, start, newConversation, findServer } from "../../mejai-controller.mjs";
import { writeTextAtomic } from "../../lib/storage.mjs";
import { forwardActivity } from "../../activity-stream.mjs";
import { humanRequests } from "../../plugins/long-session-core.mjs";
import { continuation as autonomyContinuation } from "../../plugins/autonomy-core.mjs";
import { attachmentParts } from "./attachment-service.mjs";
export async function activity(id) {
  const server = await findServer();
  if (!server) return { sessions: [], server: null };
  const directory = "?directory=" + encodeURIComponent(path.join(base, "tarefas"));
  const sessions = (await api(server.url + "/session" + directory))
    .filter((s) => !s.parentID)
    .sort((a, b) => (b.time?.updated || 0) - (a.time?.updated || 0))
    .map((s) => ({ id: s.id, title: s.title }));
  if (!id) return { sessions };
  if (!sessions.some((s) => s.id === id)) throw Error("Choose a conversation from this kit.");
  const [messages, todos, states] = await Promise.all([
    api(server.url + "/session/" + id + "/message" + directory + "&limit=30"),
    api(server.url + "/session/" + id + "/todo" + directory),
    api(server.url + "/session/status" + directory),
  ]);
  let autonomy;
  try {
    autonomy = JSON.parse(await fs.readFile(path.join(base, "dados/autonomy", id + ".json")));
    if (autonomy.enabled && autonomy.runID !== server.runID) {
      autonomy = {
        ...autonomy,
        enabled: false,
        status: "paused",
        reason: "Agent restarted. Resume explicitly to continue.",
      };
    }
  } catch {}
  const events = messages
    .flatMap((m) =>
      (m.parts || [])
        .filter((p) => p.type === "text" || p.type === "tool")
        .map((p) =>
          p.type === "tool"
            ? {
                kind: "tool",
                tool: p.tool,
                status: p.state?.status,
                text: String(p.state?.error || p.state?.output || p.state?.title || "").slice(
                  -4000,
                ),
              }
            : { kind: m.info.role, text: p.text },
        ),
    )
    .slice(-60);
  const thinking = messages
    .filter((m) => m.info.role === "assistant")
    .slice(-1)
    .flatMap((m) => (m.parts || []).filter((p) => p.type === "reasoning"));
  return {
    sessions,
    sessionID: id,
    todos,
    autonomy,
    events,
    thinking,
    model:
      messages.at(-1)?.info?.model ||
      (messages.at(-1)?.info?.providerID
        ? { providerID: messages.at(-1).info.providerID, modelID: messages.at(-1).info.modelID }
        : null),
    status: states[id]?.type || "idle",
    url:
      server.url +
      "/" +
      Buffer.from(path.join(base, "tarefas")).toString("base64url") +
      "/session/" +
      id,
  };
}
export async function enableAutonomy({
  sessionID,
  objective,
  minutes = 480,
  maxTurns = 100,
  attachments = [],
}) {
  const supplied = typeof objective === "string" && !!objective.trim();
  if ((typeof objective !== "string" || !objective.trim()) && sessionID) {
    const server = await start();
    const history = await api(
      server.url +
        "/session/" +
        encodeURIComponent(sessionID) +
        "/message?directory=" +
        encodeURIComponent(path.join(base, "tarefas")),
    );
    const human = humanRequests(history);
    objective = [
      human[0]?.text.slice(0, 8000),
      ...human
        .slice(1)
        .slice(-4)
        .map((x) => x.text.slice(0, 1800)),
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (typeof objective !== "string" || !objective.trim() || objective.length > 16000)
    throw Error(
      "Describe the result you want. The agent will derive the plan and completion checks.",
    );
  if (
    !Number.isInteger(minutes) ||
    minutes < 5 ||
    minutes > 1440 ||
    !Number.isInteger(maxTurns) ||
    maxTurns < 1 ||
    maxTurns > 1000
  )
    throw Error("Use 5–1440 minutes and 1–1000 continuations.");
  const server = await start();
  let id = sessionID;
  if (!id) id = (await newConversation()).id;
  const current = await activity(id);
  if (current.status !== "idle")
    throw Error("Wait for this conversation to become idle before enabling autonomy.");
  const files = await attachmentParts(base, id, attachments, current.model);
  const record = {
    sessionID: id,
    objective: objective.trim(),
    enabled: true,
    status: "working",
    started: Date.now(),
    updated: Date.now(),
    minutes,
    maxTurns,
    turns: 0,
    runID: server.runID,
    generation: randomUUID(),
  };
  const folder = path.join(base, "dados/autonomy");
  await fs.mkdir(folder, { recursive: true });
  const target = path.join(folder, id + ".json");
  await writeTextAtomic(target, JSON.stringify(record));
  try {
    await api(
      server.url +
        "/session/" +
        id +
        "/prompt_async?directory=" +
        encodeURIComponent(path.join(base, "tarefas")),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: [
            ...files,
            ...(supplied ? [{ type: "text", text: objective.trim() }] : []),
            {
              type: "text",
              text: autonomyContinuation,
              synthetic: true,
              metadata: { mejaiAutomation: true },
            },
          ],
        }),
      },
    );
  } catch (e) {
    await writeTextAtomic(
      target,
      JSON.stringify({ ...record, enabled: false, status: "paused", reason: e.message }),
    );
    throw e;
  }
  return { sessionID: id, url: current.url };
}
export async function pauseAutonomy({ sessionID }) {
  if (!/^ses_[\w-]+$/.test(sessionID || "")) throw Error("Select an autonomous conversation.");
  const file = path.join(base, "dados/autonomy", sessionID + ".json");
  const record = JSON.parse(await fs.readFile(file));
  await writeTextAtomic(
    file,
    JSON.stringify({
      ...record,
      enabled: false,
      status: "paused",
      reason: "Paused by you.",
      generation: randomUUID(),
      updated: Date.now(),
    }),
  );
  const server = await findServer();
  if (server)
    await api(
      server.url +
        "/session/" +
        sessionID +
        "/abort?directory=" +
        encodeURIComponent(path.join(base, "tarefas")),
      { method: "POST" },
    );
  return { paused: true };
}
export async function streamActivity(id, res) {
  if (!/^ses_[\w-]+$/.test(id || "")) throw Error("Choose a conversation.");
  const known = await activity(id);
  if (!known.sessionID) throw Error("Agent is stopped.");
  const server = await findServer();
  if (!server) throw Error("Agent is stopped.");
  return forwardActivity(server, id, path.join(base, "tarefas"), res);
}
export async function reopenConversation({ id }) {
  if (!/^ses_[a-zA-Z0-9]+$/.test(id || "")) throw Error("Choose a saved conversation.");
  const server = await start();
  const session = await api(
    server.url + "/session/" + id + "?directory=" + encodeURIComponent(path.join(base, "tarefas")),
  );
  if (session.id !== id || typeof session.directory !== "string")
    throw Error("Conversation unavailable in the current database.");
  return {
    id,
    url:
      server.url +
      "/" +
      Buffer.from(session.directory, "utf8").toString("base64url") +
      "/session/" +
      id,
  };
}
