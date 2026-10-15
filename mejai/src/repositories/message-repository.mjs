import path from "node:path";
import fs from "node:fs/promises";
import { base } from "../../platform.mjs";
import { api } from "../../mejai-controller.mjs";
import { session, directory } from "./session-repository.mjs";

export const messageRepository = {
  async assertIdle(sessionID) {
    const server = await session(sessionID);
    const states = await api(server.url + "/session/status" + directory);
    if (states[sessionID]?.type && states[sessionID].type !== "idle")
      throw Error("Stop the current turn before editing a message.");
    try {
      const autonomy = JSON.parse(
        await fs.readFile(path.join(base, "dados/autonomy", sessionID + ".json")),
      );
      if (autonomy.enabled && autonomy.runID === server.runID)
        throw Error("Pause autonomy before editing a message.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  },
  async message(sessionID, messageID) {
    const server = await session(sessionID);
    const message = await api(
      server.url + "/session/" + sessionID + "/message/" + messageID + directory,
    );
    if (message.info.sessionID !== sessionID)
      throw Error("Message unavailable in this conversation.");
    return message;
  },
  async attachments(message) {
    const attachments = (message.parts || []).filter(
      (part) => part.type === "file" || (part.type === "text" && part.metadata?.mejaiAttachment),
    );
    return attachments.map((part) =>
      part.type === "file"
        ? { type: "file", mime: part.mime, filename: part.filename, url: part.url }
        : { type: "text", text: part.text, metadata: part.metadata },
    );
  },
  async fork(sessionID, messageID) {
    await this.assertIdle(sessionID);
    const server = await session(sessionID);
    return api(server.url + "/session/" + sessionID + "/fork" + directory, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageID }),
    });
  },
  async submit(sessionID, original, text, attachments) {
    const server = await session(sessionID);
    await api(server.url + "/session/" + sessionID + "/prompt_async" + directory, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: original.info.agent,
        model: original.info.model,
        parts: [{ type: "text", text }, ...attachments],
      }),
    });
  },
};
