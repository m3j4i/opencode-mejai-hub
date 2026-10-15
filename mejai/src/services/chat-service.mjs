import { scriptArtifacts } from "./script-artifact-service.mjs";
import { attachmentParts } from "./attachment-service.mjs";
import { storeUpload } from "../repositories/attachment-repository.mjs";
import path from "node:path";
import fs from "node:fs/promises";
import { base } from "../../platform.mjs";
import { api, newConversation, pauseAutonomy, enableAutonomy } from "../../mejai-controller.mjs";
import { directory, session } from "../repositories/session-repository.mjs";
export async function snapshot(id, recent = false) {
  const server = await session(id);
  const [messages, todos, states, permissions, questions] = await Promise.all([
    api(server.url + "/session/" + id + "/message" + directory + (recent ? "&limit=30" : "")),
    api(server.url + "/session/" + id + "/todo" + directory),
    api(server.url + "/session/status" + directory),
    api(server.url + "/permission" + directory),
    api(server.url + "/question" + directory),
  ]);
  let autonomy;
  try {
    autonomy = JSON.parse(await fs.readFile(path.join(base, "dados/autonomy", id + ".json")));
    if (autonomy.runID !== server.runID)
      autonomy = {
        ...autonomy,
        enabled: false,
        status: "paused",
        reason: "Agent restarted. Resume explicitly.",
      };
  } catch {}
  return {
    sessionID: id,
    messages,
    scriptArtifacts: await scriptArtifacts(messages, path.join(base, "tarefas")),
    todos,
    autonomy,
    status: states[id] || { type: "idle" },
    permissions: permissions.filter((x) => x.sessionID === id),
    questions: questions.filter((x) => x.sessionID === id),
  };
}
export async function send({
  sessionID,
  text,
  attachments = [],
  autonomy = false,
  minutes = 480,
  maxTurns = 100,
}) {
  if (!text?.trim() && attachments.length)
    text = "Inspect the attached files and explain what they contain.";
  if (typeof text !== "string" || !text.trim() || text.length > 100000)
    throw Error("Enter a message of up to 100,000 characters.");
  const id = sessionID || (await newConversation()).id,
    server = await session(id);
  const states = await api(server.url + "/session/status" + directory);
  if (states[id]?.type && states[id].type !== "idle")
    throw Error("Wait for the current turn or stop it before sending. Your draft is preserved.");
  const latest = attachments.length
    ? (await api(server.url + "/session/" + id + "/message" + directory + "&limit=1")).at(-1)?.info
    : null;
  const selectedModel =
    latest?.model ||
    (latest?.providerID ? { providerID: latest.providerID, modelID: latest.modelID } : null);
  const files = await attachmentParts(base, id, attachments, selectedModel);
  if (autonomy)
    return enableAutonomy({
      sessionID: id,
      objective: text,
      minutes,
      maxTurns,
      attachments,
    });
  await api(server.url + "/session/" + id + "/prompt_async" + directory, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parts: [{ type: "text", text: text.trim() }, ...files],
    }),
  });
  return { sessionID: id };
}
export async function abort({ sessionID }) {
  const server = await session(sessionID);
  // Pausing is best effort when this conversation has never enabled autonomy.
  try {
    await pauseAutonomy({ sessionID });
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  await api(server.url + "/session/" + sessionID + "/abort" + directory, {
    method: "POST",
  });
  return { stopped: true };
}
export async function respond({ sessionID, kind, id, reply, answers }) {
  if (!["permission", "question"].includes(kind) || !/^\w+$/.test(id || ""))
    throw Error("Invalid pending request.");
  const server = await session(sessionID);
  const pending = await api(server.url + "/" + kind + directory);
  if (!pending.some((x) => x.id === id && x.sessionID === sessionID))
    throw Error("This request is no longer pending in this conversation.");
  if (kind === "permission" && !["once", "reject"].includes(reply))
    throw Error("Choose Allow once or Deny.");
  if (
    kind === "question" &&
    (!Array.isArray(answers) ||
      !answers.every((a) => Array.isArray(a) && a.every((v) => typeof v === "string")))
  )
    throw Error("Answer each question.");
  return api(server.url + "/" + kind + "/" + id + "/reply" + directory, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(kind === "permission" ? { reply } : { answers }),
  });
}

export async function upload(sessionID, name, request) {
  await session(sessionID);
  return storeUpload(base, sessionID, name, request);
}
export async function remove({ sessionID, confirm }) {
  if (confirm !== "DELETE") throw Error("Confirm deletion.");
  const server = await session(sessionID),
    states = await api(server.url + "/session/status" + directory),
    ids = [sessionID];
  for (let index = 0; index < ids.length; index++) {
    const children = await api(server.url + "/session/" + ids[index] + "/children" + directory);
    for (const child of children) if (!ids.includes(child.id)) ids.push(child.id);
  }
  if (ids.some((id) => states[id]?.type && states[id].type !== "idle"))
    throw Error("Stop this conversation and its child conversations before deleting.");
  await api(server.url + "/session/" + sessionID + directory, {
    method: "DELETE",
  });
  for (const id of ids)
    await fs.unlink(path.join(base, "dados/autonomy", id + ".json")).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  return { deleted: ids };
}
