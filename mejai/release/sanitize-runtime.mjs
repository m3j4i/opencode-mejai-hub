import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { releaseVersion } from "./release-documents.mjs";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const staging = path.join(workspace, "work", "release-" + releaseVersion);
for (const platform of ["windows", "linux"]) {
  const root = path.join(staging, platform, "Agente-Local");
  async function remove(relative) {
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) throw Error("Cleanup escaped release");
    await fs.rm(target, { recursive: true, force: true });
  }
  async function visit(relative) {
    for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
      const filename = relative + "/" + entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (["__pycache__", ".links", ".temp"].includes(entry.name)) await remove(filename);
        else await visit(filename);
      } else if (/\.(?:pyc|pyo)$/.test(entry.name) || entry.name === ".lock")
        await remove(filename);
      else if (platform === "windows" && /(?:python|ocr|serena)\/Scripts\/.*\.exe$/i.test(filename))
        await remove(filename);
      else if (entry.name.endsWith(".py")) {
        const file = path.join(root, filename);
        const content = await fs.readFile(file, "utf8");
        if (/^#![A-Za-z]:\\Users\\/.test(content))
          await fs.writeFile(file, content.replace(/^#![^\r\n]+/, "#!/usr/bin/env python3"));
      }
    }
  }
  await visit("runtime");
  if (platform === "linux") {
    const managedRoot = path.join(root, "runtime/linux/python-managed");
    const managed = (await fs.readdir(managedRoot)).find((name) =>
      /^cpython-3\.13\.\d+-linux-x86_64-gnu$/.test(name),
    );
    const filename = path.join(
      managedRoot,
      managed,
      "lib/python3.13/_sysconfigdata__linux_x86_64-linux-gnu.py",
    );
    const content = await fs.readFile(filename, "utf8");
    const previousPrefix = content.match(/"prefix": "([^"]+)"/)?.[1];
    if (!previousPrefix) throw Error("Python build prefix missing");
    if (!content.includes("# Mejai portable sysconfig")) {
      const portable = content.replaceAll(previousPrefix, "/__MEJAI_PYTHON_PREFIX__");
      await fs.writeFile(
        filename,
        portable +
          '\n# Mejai portable sysconfig\nimport os as _mejai_os\n_mejai_prefix = _mejai_os.path.dirname(_mejai_os.path.dirname(_mejai_os.path.dirname(_mejai_os.path.abspath(__file__))))\nbuild_time_vars = {key: value.replace("/__MEJAI_PYTHON_PREFIX__", _mejai_prefix) if isinstance(value, str) else value for key, value in build_time_vars.items()}\n',
      );
    }
  }
}
console.log("Removed generated caches and fixed portable Python launchers/build metadata.");
