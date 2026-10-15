import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { bin, runtime, environment } from "./platform.mjs";

const run = promisify(execFile);
for (const filename of ["tools/7zz", "tools/ffmpeg", "tools/ffprobe", "tor/tor/tor", "camoufox-engine/camoufox"]) await fs.access(runtime(filename));
try {
  await run(bin.tor, ["--version"], { env: environment() });
} catch {
  throw Error("Bundled Linux libraries could not load. This package was validated on Ubuntu 26.04 x86_64. Use that environment or build compatible runtimes from the source package.");
}
console.log("Bundled tools are ready; system packages were not modified.");
