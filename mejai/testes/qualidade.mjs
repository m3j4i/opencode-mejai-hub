import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function files(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(file)));
    else result.push(file);
  }
  return result;
}
const modules = [
  ...(await files(path.join(base, "src"))),
  ...(await files(path.join(base, "ui"))),
].filter((file) => /\.(?:mjs|js)$/.test(file) && file !== path.join(base, "ui/editor.js"));
for (const file of modules) {
  const content = await fs.readFile(file, "utf8");
  if (content.split("\n").length > 350 || Buffer.byteLength(content) > 20000)
    throw Error("Split this module by responsibility: " + path.relative(base, file));
  const check = spawnSync(process.execPath, ["--check", file], {
    cwd: base,
    encoding: "utf8",
    windowsHide: true,
  });
  if (check.status !== 0) throw Error(check.stderr);
}
for (const [program, args] of [
  [
    "eslint/bin/eslint.js",
    [
      "ui",
      "src",
      "testes/unit/test-inline-scripts.mjs",
      "testes/unit/test-torch.mjs",
      "testes/unit/test-chat-improvements.mjs",
      "testes/unit/test-hub-storage.mjs",
      "testes/unit/test-chat-stream.mjs",
      "testes/unit/test-attachment-parts.mjs",
    ],
  ],
  [
    "prettier/bin/prettier.cjs",
    [
      "--check",
      "ui/hub.html",
      "ui/hub.css",
      "ui/chat.css",
      "ui/hub.js",
      "ui/chat.js",
      "ui/language.js",
      "ui/chat/*.js",
      "ui/hub/*.js",
      "src/**/*.mjs",
      "eslint.config.mjs",
      "testes/qualidade.mjs",
      "testes/unit/test-hub-storage.mjs",
      "testes/unit/test-chat-stream.mjs",
      "testes/unit/test-attachment-parts.mjs",
    ],
  ],
]) {
  const result = spawnSync(
    process.execPath,
    [path.join(base, "runtime/devtools/node_modules", program), ...args],
    { cwd: base, stdio: "inherit", windowsHide: true },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("PASS module size, syntax, lint and formatting. Third-party bundles excluded.");
