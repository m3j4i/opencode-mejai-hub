import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readAttachment } from "../repositories/attachment-repository.mjs";
export async function attachmentParts(base, sessionID, ids = [], selectedModel) {
  if (!Array.isArray(ids) || ids.length > 10 || new Set(ids).size !== ids.length)
    throw Error("Attach up to 10 different files.");
  if (!ids.length) return [];
  const config = JSON.parse(await fs.readFile(path.join(base, "opencode.json"), "utf8"));
  const slash = (config.model || "").indexOf("/"),
    provider = selectedModel?.providerID || config.model?.slice(0, slash),
    model = selectedModel?.modelID || config.model?.slice(slash + 1);
  const inputs = config.provider?.[provider]?.models?.[model]?.modalities?.input || ["text"];
  const parts = [];
  for (const id of ids) {
    const attachment = await readAttachment(base, sessionID, id);
    const visual = attachment.mime.startsWith("image/") && inputs.includes("image");
    const pdf = attachment.mime === "application/pdf" && inputs.includes("pdf");
    // Other formats stay available to the kit tools. Uploading never executes a file.
    parts.push({
      type: "text",
      text:
        "Attached file: " +
        JSON.stringify({
          name: attachment.name,
          path: attachment.file,
          size: attachment.size,
          mime: attachment.mime,
        }) +
        (attachment.mime.startsWith("image/") && !visual
          ? " The selected model has no declared image input; use available OCR/image tools or explain the limitation."
          : ""),
      metadata: {
        mejaiAttachment: {
          id: attachment.id,
          name: attachment.name,
          size: attachment.size,
          mime: attachment.mime,
        },
      },
    });
    if (visual || pdf)
      parts.push({
        type: "file",
        mime: attachment.mime,
        filename: attachment.name,
        url: pathToFileURL(attachment.file).href,
      });
  }
  return parts;
}
