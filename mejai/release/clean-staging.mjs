import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyTree } from "./copy-service.mjs";
import { releaseVersion } from "./release-documents.mjs";

const releaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(releaseDirectory, "../../..");
const staging = path.join(workspace, "work", "release-" + releaseVersion);
const reports = path.join(workspace, "outputs", "releases", releaseVersion);
await fs.mkdir(reports, { recursive: true });
async function removeOwned(root, relative) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) || !root.startsWith(staging + path.sep))
    throw Error("Cleanup escaped staging");
  await fs.rm(target, { recursive: true, force: true });
}
for (const platform of ["windows", "linux"]) {
  const root = path.join(staging, platform, "Agente-Local");
  try {
    await fs.copyFile(
      path.join(root, "logs/validacao/resultado.json"),
      path.join(reports, "tests-" + platform + ".json"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const name of [
    "dados",
    "logs",
    "tarefas",
    "downloads",
    "navegador",
    "navegador-camoufox",
    "navegador-config.json",
    "Exportar-pacote.cmd",
    "runtime/browsers/.links",
    "runtime/linux/browsers/.links",
    "runtime/linux/ready.json",
    "runtime/linux/extras-ready.json",
  ])
    await removeOwned(root, name);
  if (platform === "windows") {
    for (const name of ["start.sh", "linux-setup.mjs", "linux-extras.mjs"])
      await removeOwned(root, name);
  }
  const config = JSON.parse(await fs.readFile(path.join(root, "opencode.json"), "utf8"));
  if (
    config.model ||
    config.small_model ||
    config.autoupdate ||
    Object.keys(config.provider.ollama.models).length ||
    config.plugin.length ||
    Object.keys(config.mcp).length
  )
    throw Error("Distribution is not fresh");
}
const source = path.join(staging, "source/opencode-mejai");
await copyTree(
  releaseDirectory,
  path.join(source, "mejai/release"),
  (name) => name !== "__pycache__",
);
for (const name of ["Atualizar-OpenCode.ps1", "Exportar-pacote.ps1", "Editor-notepad.ps1"])
  await removeOwned(source, "mejai/" + name);
const notes = await fs.readFile(
  path.join(staging, "windows/Agente-Local/THIRD-PARTY-NOTICES.md"),
  "utf8",
);
const correctedNotes = notes.replace(
  "- FFmpeg: see the exact build configuration",
  "- FFmpeg Windows 7.1 full build: GPL-3.0, source revision https://github.com/FFmpeg/FFmpeg/commit/b08d7969c5 and build sources https://www.gyan.dev/ffmpeg/builds/ . FFmpeg Linux: see the exact build configuration",
);
for (const root of [
  path.join(staging, "windows/Agente-Local"),
  path.join(staging, "linux/Agente-Local"),
  path.join(source, "mejai"),
])
  await fs.writeFile(path.join(root, "THIRD-PARTY-NOTICES.md"), correctedNotes);
console.log("Only staging data was removed; the installed kit was preserved.");
