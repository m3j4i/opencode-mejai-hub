import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, URL } from "node:url";

const run = promisify(execFile);
const allowed = new Set([
  "mejai-controller.mjs",
  "src/services/startup-service.mjs",
  "release.json",
]);
const hash = (content) => createHash("sha256").update(content).digest("hex");

export async function applyUpdate(target, bundle) {
  const root = await fs.realpath(target);
  const manifest = JSON.parse(await fs.readFile(path.join(bundle, "manifest.json"), "utf8"));
  const release = JSON.parse(await fs.readFile(path.join(root, "release.json"), "utf8"));
  if (release.engineVersion !== manifest.engineVersion || release.platform !== "windows")
    throw Error("Select the Windows Mejai Hub 1.18.35-mejai.1 installation.");
  if (manifest.version !== "1.18.35-mejai.1-hub.20261015") throw Error("Unknown update version.");
  if (Object.keys(manifest.files).length !== allowed.size) throw Error("Incomplete update.");
  const files = [];
  for (const [relative, digest] of Object.entries(manifest.files)) {
    if (!allowed.has(relative)) throw Error("Unexpected update file: " + relative);
    const destination = path.join(root, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const parent = await fs.realpath(path.dirname(destination));
    if (parent !== root && !parent.startsWith(root + path.sep)) throw Error("Path escapes kit.");
    const stat = await fs.lstat(destination).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw Error("Invalid target file.");
    const content = await fs.readFile(path.join(bundle, "payload", relative));
    if (hash(content) !== digest) throw Error("Checksum mismatch: " + relative);
    files.push({ relative, destination, content, existed: !!stat });
  }
  await stopHub(root);
  const backup = path.join(root, "dados", "updates", manifest.version + "-" + Date.now());
  await fs.mkdir(backup, { recursive: true });
  for (const file of files) {
    if (!file.existed) continue;
    const saved = path.join(backup, file.relative);
    await fs.mkdir(path.dirname(saved), { recursive: true });
    await fs.copyFile(file.destination, saved);
  }
  const applied = [];
  try {
    for (const file of files) {
      await fs.writeFile(file.destination + ".update", file.content, { flag: "wx" });
      await fs.rename(file.destination + ".update", file.destination);
      applied.push(file);
    }
  } catch (error) {
    for (const file of applied.reverse()) {
      if (file.existed) await fs.copyFile(path.join(backup, file.relative), file.destination);
      else await fs.unlink(file.destination);
    }
    throw error;
  }
  return { version: manifest.version, backup };
}

async function stopHub(root) {
  const file = path.join(root, "dados/hub-win32.json");
  const connection = await fs
    .readFile(file, "utf8")
    .then(JSON.parse)
    .catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
  if (!connection) return;
  const url = new URL(connection.url);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1")
    throw Error("Invalid local Hub address.");
  const health = await fetch(url + "api/health", { signal: AbortSignal.timeout(3000) }).catch(
    () => null,
  );
  if (!health) return;
  if (!health.ok || (await health.json()).base !== root) throw Error("Hub ownership mismatch.");
  if (!Number.isSafeInteger(connection.pid) || connection.pid <= 0) throw Error("Invalid Hub PID.");
  const result = await run(
    "powershell.exe",
    ["-NoProfile", "-Command", "(Get-Process -Id " + connection.pid + " -ErrorAction Stop).Path"],
    { windowsHide: true },
  );
  const executable = await fs.realpath(result.stdout.trim());
  const expected = await fs.realpath(path.join(root, "runtime/node/node.exe"));
  if (executable.toLowerCase() !== expected.toLowerCase()) throw Error("Hub executable mismatch.");
  const stopped = await fetch(url + "api/stop", {
    method: "POST",
    headers: { "X-Mejai-Token": connection.token, "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(20000),
  });
  if (!stopped.ok)
    throw Error("Stop the current task in the chat before updating: " + (await stopped.text()));
  process.kill(connection.pid);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw Error("Pass the Agente-Local installation directory.");
  console.log(
    JSON.stringify(
      await applyUpdate(process.argv[2], path.dirname(fileURLToPath(import.meta.url))),
      null,
      2,
    ),
  );
}
