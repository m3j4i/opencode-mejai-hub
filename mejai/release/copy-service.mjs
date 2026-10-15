import fs from "node:fs/promises";
import path from "node:path";
import { includeRuntimeFile, mayTraverse } from "./package-policy.mjs";

export async function copyRuntime(source, destination, platform) {
  const links = [];
  let count = 0;
  async function visit(relative = "") {
    const folder = path.join(source, relative);
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const name = relative ? relative + "/" + entry.name : entry.name;
      if (entry.isDirectory()) {
        if (mayTraverse(name, platform)) await visit(name);
        continue;
      }
      if (!includeRuntimeFile(name, platform)) continue;
      const origin = path.join(source, name);
      const target = path.join(destination, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      if (entry.isSymbolicLink()) {
        links.push({ path: name, target: await fs.readlink(origin) });
      } else {
        await fs.copyFile(origin, target);
        count++;
      }
    }
  }
  await visit();
  return { count, links };
}

export async function copyTree(source, destination, include = () => true) {
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (!include(entry.name, entry)) continue;
    const target = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(target, { recursive: true });
      await copyTree(path.join(source, entry.name), target, include);
    } else if (entry.isFile()) {
      await fs.mkdir(destination, { recursive: true });
      await fs.copyFile(path.join(source, entry.name), target);
    }
  }
}
