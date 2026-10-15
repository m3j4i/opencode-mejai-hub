import fs from "node:fs/promises";
import path from "node:path";

export const MAX_SCRIPT_BYTES = 256 * 1024;

export async function readScriptArtifact(evidence, directory) {
  const filename = evidence.filePath;
  const artifact = {
    path: filename,
    name: path.basename(filename.replaceAll("\\", "/")),
    source: evidence.kind === "write" ? "recorded-write" : "current-file",
  };
  try {
    let text;
    if (evidence.kind === "write" && typeof evidence.content === "string") {
      if (Buffer.byteLength(evidence.content, "utf8") > MAX_SCRIPT_BYTES)
        return { ...artifact, status: "too_large" };
      text = evidence.content;
    } else {
      // The service supplies only paths recorded in a successful write/edit of this conversation.
      const target = path.resolve(directory, filename);
      const info = await fs.lstat(target);
      if (!info.isFile() || info.isSymbolicLink()) return { ...artifact, status: "unavailable" };
      if (info.size > MAX_SCRIPT_BYTES) return { ...artifact, status: "too_large" };
      const bytes = await fs.readFile(target);
      if (bytes.length > MAX_SCRIPT_BYTES) return { ...artifact, status: "too_large" };
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    if (text.includes("\0")) return { ...artifact, status: "unavailable" };
    return { ...artifact, status: "ready", text };
  } catch {
    return { ...artifact, status: "unavailable" };
  }
}
