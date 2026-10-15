import path from "node:path";
import { base } from "../../platform.mjs";
import { start, api } from "../../mejai-controller.mjs";
export const directory = "?directory=" + encodeURIComponent(path.join(base, "tarefas"));
export async function session(id) {
  if (!/^ses_[a-zA-Z0-9_-]+$/.test(id || "")) throw Error("Choose a conversation.");
  const server = await start();
  const info = await api(server.url + "/session/" + id + directory);
  if (info.id !== id) throw Error("Conversation unavailable.");
  return server;
}
