import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_UPLOAD = 50 * 1024 * 1024;
function folder(base, sessionID) {
  if (!/^ses_[\w-]+$/.test(sessionID || "")) throw Error("Invalid conversation.");
  return path.join(base, "tarefas", "anexos", sessionID);
}
export async function storeUpload(base, sessionID, name, stream) {
  if (typeof name !== "string" || !name.trim()) throw Error("Choose a file.");
  const safe =
    name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/[. ]+$/, "")
      .slice(0, 100) || "attachment";
  const id = randomUUID(),
    root = folder(base, sessionID),
    dir = path.join(root, id);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "file-" + safe),
    temporary = path.join(dir, "upload.partial");
  let size = 0,
    head = Buffer.alloc(0);
  const handle = await fs.open(temporary, "wx");
  try {
    for await (const raw of stream) {
      const chunk = Buffer.from(raw);
      size += chunk.length;
      if (size > MAX_UPLOAD) throw Error("Each attachment must be 50 MB or smaller.");
      if (head.length < 16) head = Buffer.concat([head, chunk.subarray(0, 16 - head.length)]);
      await handle.writeFile(chunk);
    }
  } catch (e) {
    await handle.close();
    await fs.rm(dir, { recursive: true, force: true });
    throw e;
  }
  await handle.close();
  await fs.rename(temporary, file);
  let mime = "application/octet-stream";
  if (head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    mime = "image/png";
  else if (head[0] === 255 && head[1] === 216 && head[2] === 255) mime = "image/jpeg";
  else if (/^GIF8[79]a/.test(head.toString("ascii"))) mime = "image/gif";
  else if (head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP")
    mime = "image/webp";
  else if (head.toString("ascii", 0, 5) === "%PDF-") mime = "application/pdf";
  const record = { id, name: safe, size, mime, sessionID };
  await fs.writeFile(path.join(dir, "metadata.json"), JSON.stringify(record));
  return record;
}
export async function readAttachment(base, sessionID, id) {
  if (!/^[a-f0-9-]{36}$/.test(id || "")) throw Error("Invalid attachment.");
  const dir = path.join(folder(base, sessionID), id),
    record = JSON.parse(await fs.readFile(path.join(dir, "metadata.json"), "utf8"));
  if (
    record.sessionID !== sessionID ||
    record.id !== id ||
    path.basename(record.name) !== record.name
  )
    throw Error("Invalid attachment metadata.");
  const file = path.join(dir, "file-" + record.name),
    real = await fs.realpath(file),
    root = await fs.realpath(folder(base, sessionID));
  if (!real.startsWith(root + path.sep)) throw Error("Attachment outside conversation.");
  return { ...record, file };
}
