import path from "node:path";
import { readScriptArtifact } from "../repositories/script-artifact-repository.mjs";

const languages = {
  ".py": "python",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".ps1": "powershell",
  ".sh": "bash",
  ".bat": "bat",
  ".cmd": "bat",
  ".rb": "ruby",
  ".lua": "lua",
};
const normalized = (value) => {
  const normalizedPath = value.replaceAll("\\", "/");
  return process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath;
};
function humanText(message) {
  return (message.parts || [])
    .filter((part) => part.type === "text" && !part.synthetic && !part.metadata?.mejaiAttachment)
    .map((part) => part.text || "")
    .join("\n");
}

export async function scriptArtifacts(messages, directory, readArtifact = readScriptArtifact) {
  const written = new Map();
  const artifacts = [];
  let omitCode = false;
  for (const message of messages) {
    if (message.info.role === "user") {
      const request = humanText(message).trim();
      if (
        request &&
        !/^\[(?:MEJAI|Automatic continuation|Recuperacao)/.test(request) &&
        !/^(continue|continuar|prossiga|go on|ok)[.!\s]*$/i.test(request)
      ) {
        written.clear();
        omitCode =
          /(?:n[aã]o\s+(?:mostre|exiba|envie)|do not\s+(?:show|include))\s+(?:o\s+)?(?:c[oó]digo|script|code)|(?:apenas|somente|only|just)\s+(?:o\s+)?(?:caminho|path)\b/i.test(
            request,
          );
      }
      continue;
    }
    if (message.info.role !== "assistant") continue;
    for (const part of message.parts || []) {
      const input = part.state?.input;
      if (
        part.type !== "tool" ||
        !["write", "edit"].includes(part.tool) ||
        part.state?.status !== "completed" ||
        part.state.error ||
        Number(part.state.metadata?.exit || 0) !== 0 ||
        typeof input?.filePath !== "string"
      )
        continue;
      if (!languages[path.extname(input.filePath).toLowerCase()]) continue;
      written.set(normalized(input.filePath), {
        kind: part.tool,
        filePath: input.filePath,
        content: input.content,
      });
    }
    if (omitCode || message.info.finish !== "stop" || message.info.error) continue;
    const text = humanText(message);
    if (!text.trim()) continue;
    const lower = normalized(text);
    const candidates = [...written.values()]
      .filter((evidence) => {
        const full = normalized(evidence.filePath),
          name = full.split("/").at(-1);
        const unique =
          [...written.keys()].filter((filename) => filename.split("/").at(-1) === name).length ===
          1;
        return hasReference(lower, full) || (unique && hasReference(lower, name));
      })
      .slice(0, 3);
    for (const evidence of candidates) {
      const artifact = await readArtifact(evidence, directory);
      if (
        artifact.status === "ready" &&
        text.replaceAll("\r\n", "\n").includes(artifact.text.replaceAll("\r\n", "\n").trim())
      )
        continue;
      artifacts.push({
        ...artifact,
        messageID: message.info.id,
        language: languages[path.extname(evidence.filePath).toLowerCase()],
      });
    }
  }
  return artifacts;
}

function hasReference(text, reference) {
  let position = text.indexOf(reference);
  while (position >= 0) {
    const before = text[position - 1] || "",
      after = text.slice(position + reference.length);
    const validBefore = !before || !/[a-zA-Z0-9_.-]/.test(before);
    const validAfter =
      !after ||
      !/[a-zA-Z0-9_.-]/.test(after[0]) ||
      (after[0] === "." && (!after[1] || /\s/.test(after[1])));
    if (validBefore && validAfter) return true;
    position = text.indexOf(reference, position + 1);
  }
  return false;
}
