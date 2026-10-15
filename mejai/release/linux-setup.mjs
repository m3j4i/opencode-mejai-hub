import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { base, bin, runtime, environment } from "./platform.mjs";

if (process.platform !== "linux" || process.arch !== "x64")
  throw Error("This release requires Linux x86_64.");
const run = promisify(execFile);
const env = environment();
const version = (await run(bin.opencode, ["--version"], { env })).stdout.trim();
const manifest = JSON.parse(await fs.readFile(path.join(base, "release.json"), "utf8"));
if (version !== manifest.engineVersion)
  throw Error(
    "The bundled Mejai fork is missing or has an unexpected version. Restore this release; do not install the official OpenCode over it.",
  );
const managed = (await fs.readdir(runtime("python-managed"))).find((name) =>
  /^cpython-3\.13\.\d+-linux-x86_64-gnu$/.test(name),
);
if (!managed) throw Error("Bundled Python is missing.");
const python = runtime("python-managed", managed, "bin/python3.13");
const uv = runtime("uv-download/uv-x86_64-unknown-linux-gnu/uv");
const marker = runtime("ready.json");
let previous;
try {
  previous = JSON.parse(await fs.readFile(marker, "utf8"));
} catch {}
if (previous?.base !== base || previous?.engineVersion !== version) {
  for (const group of ["python", "ocr", "serena"]) {
    await run(
      uv,
      ["venv", "--allow-existing", "--relocatable", "--python", python, runtime(group)],
      { env, cwd: base },
    );
    await run(
      path.join(runtime(group), "bin/python3"),
      ["-c", "import sys; assert sys.version_info[:2] == (3, 13)"],
      { env },
    );
  }
  await fs.writeFile(marker, JSON.stringify({ base, version: 2, engineVersion: version }));
}
console.log("Mejai fork and portable Python are ready. No upstream update was performed.");
