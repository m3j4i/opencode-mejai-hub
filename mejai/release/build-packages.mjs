import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { copyRuntime, copyTree } from "./copy-service.mjs";
import { cleanConfig } from "./package-policy.mjs";
import { writeReleaseDocuments, inventoryPackages, releaseVersion } from "./release-documents.mjs";

const run = promisify(execFile);
const releaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const fork = path.resolve(releaseDirectory, "../..");
const workspace = path.dirname(fork);
const original = process.argv[2];
if (!original || !path.isAbsolute(original))
  throw Error("Pass the absolute installed-kit directory.");
const staging = path.join(workspace, "work", "release-" + releaseVersion);
await fs.mkdir(staging, { recursive: true });
const git = path.join(original, "runtime/git/cmd/git.exe");
const settings = cleanConfig(
  JSON.parse(await fs.readFile(path.join(original, "opencode.json"), "utf8")),
);
for (const platform of ["windows", "linux"]) {
  const destination = path.join(staging, platform, "Agente-Local");
  let existing = false;
  try {
    await fs.access(destination);
    existing = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing && !process.argv.includes("--resume"))
    throw Error("Staging exists; inspect it and use --resume.");
  console.log("Copying clean " + platform + " runtime...");
  await fs.mkdir(destination, { recursive: true });
  const copied =
    existing && platform === "windows"
      ? { count: "existing", links: [] }
      : await copyRuntime(original, destination, platform);
  // Prefer the current first-party source snapshot over older installed files.
  await copyTree(
    path.join(fork, "mejai"),
    destination,
    (name) =>
      ![
        "docs",
        "devtools",
        "recreate",
        "release",
        "logs",
        "dados",
        "README.md",
        "LEIA-ME.txt",
        ".gitignore",
      ].includes(name),
  );
  for (const name of ["Atualizar-OpenCode.ps1", "Exportar-pacote.ps1", "Editor-notepad.ps1"])
    await fs.rm(path.join(destination, name), { force: true });
  if (platform === "linux") {
    for (const entry of await fs.readdir(destination))
      if (/\.(?:ps1|cmd)$/.test(entry)) await fs.rm(path.join(destination, entry));
    await fs.writeFile(path.join(destination, "release-links.json"), JSON.stringify(copied.links));
    await fs.copyFile(
      path.join(fork, "packages/opencode/dist/opencode-linux-x64-baseline/bin/opencode"),
      path.join(destination, "runtime/linux/opencode"),
    );
    for (const name of ["linux-setup.mjs", "linux-extras.mjs"])
      await fs.copyFile(path.join(releaseDirectory, name), path.join(destination, name));
  } else {
    await fs.copyFile(
      path.join(original, "runtime/opencode.exe"),
      path.join(destination, "runtime/opencode.exe"),
    );
    await run(
      path.join(original, "runtime/node/node.exe"),
      [
        path.join(destination, "runtime/browser/node_modules/playwright/cli.js"),
        "install",
        "chromium",
      ],
      {
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: path.join(destination, "runtime/browsers"),
        },
        maxBuffer: 5 * 1024 * 1024,
      },
    );
  }
  for (const name of [
    "opencode.json",
    "colibri.json",
    "navegador-preferencias.json",
    "conexoes.exemplo.json",
  ])
    await fs.rm(path.join(destination, name), { force: true });
  await fs.writeFile(
    path.join(destination, "opencode.json"),
    JSON.stringify(settings, null, 2) + "\n",
  );
  await fs.writeFile(
    path.join(destination, "colibri.json"),
    JSON.stringify({ modelDirectory: "", backend: "cpu", context: 16384, output: 4096 }, null, 2) +
      "\n",
  );
  await fs.writeFile(
    path.join(destination, "navegador-preferencias.json"),
    '{"engine":"camoufox"}\n',
  );
  const connections = Object.fromEntries(
    Object.entries(
      JSON.parse(await fs.readFile(path.join(original, "conexoes.exemplo.json"), "utf8")),
    ).map(([key, value]) => [
      key,
      typeof value === "number"
        ? 0
        : ["ATLASSIAN_URL", "SEARXNG_URL", "DOCKER_PIPE"].includes(key)
          ? value
          : "",
    ]),
  );
  await fs.writeFile(
    path.join(destination, "conexoes.exemplo.json"),
    JSON.stringify(connections, null, 2) + "\n",
  );
  await fs.copyFile(path.join(fork, "LICENSE"), path.join(destination, "LICENSE"));
  await fs.writeFile(
    path.join(destination, "fork.json"),
    JSON.stringify(
      {
        name: "opencode (mejai hub)",
        version: "1.18.35-mejai.1",
        upstream: "https://github.com/anomalyco/opencode",
        baseCommit: "53d1eabb61e21162157817bf677da0a4ad3332e3",
        source: "See the separate source archive",
        officialUpdates: false,
      },
      null,
      2,
    ) + "\n",
  );
  await writeReleaseDocuments(destination, platform);
  console.log(
    platform +
      ": " +
      copied.count +
      " files, " +
      (await inventoryPackages(destination)) +
      " dependency records",
  );
}

const source = path.join(staging, "source", "opencode-mejai");
await fs.mkdir(source, { recursive: true });
const tracked = (
  await run(git, ["ls-files", "-z"], { cwd: fork, encoding: "utf8", maxBuffer: 30 * 1024 * 1024 })
).stdout
  .split("\0")
  .filter(Boolean);
for (const relative of tracked) {
  if (relative.startsWith("mejai/") || relative.includes("/node_modules/")) continue;
  let targetRelative = relative;
  if (relative.startsWith(".github/workflows/"))
    targetRelative = "docs/upstream-workflows/" + relative.slice(".github/workflows/".length);
  const destination = path.join(source, targetRelative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(fork, relative), destination);
}
for (const relative of [
  "packages/opencode/src/tool/python.ts",
  "packages/opencode/test/tool/python.test.ts",
]) {
  await fs.mkdir(path.dirname(path.join(source, relative)), { recursive: true });
  await fs.copyFile(path.join(fork, relative), path.join(source, relative));
}
await copyTree(
  path.join(fork, "mejai"),
  path.join(source, "mejai"),
  (name) => !["logs", "dados", "tor-live-validation.json"].includes(name),
);
await copyTree(path.join(original, "lib"), path.join(source, "mejai/lib"));
for (const name of [
  "opencode.json",
  "colibri.json",
  "navegador-preferencias.json",
  "conexoes.exemplo.json",
  "fork.json",
  "release.json",
  "THIRD-PARTY-NOTICES.md",
])
  await fs.copyFile(
    path.join(staging, "windows/Agente-Local", name),
    path.join(source, "mejai", name),
  );
for (const name of ["linux-setup.mjs", "linux-extras.mjs"])
  await fs.copyFile(path.join(releaseDirectory, name), path.join(source, "mejai", name));
await fs.copyFile(path.join(source, "README.md"), path.join(source, "docs/UPSTREAM-README.md"));
await fs.writeFile(
  path.join(source, "README.md"),
  `# OpenCode (mejai hub)\n\n${releaseVersion}; native fork based on OpenCode v1.18.35, commit 53d1eabb61e21162157817bf677da0a4ad3332e3. MIT.\n\nThis source includes the complete OpenCode fork, native Python tool, upstream-upgrade block, Hub, adapters, plugins, skills, languages and regression fixtures. Runtime dependencies and model weights are separate from source.\n\n## Build the native fork\n\nInstall Bun 1.3.14, run bun install at the repository root, then work in packages/opencode. Set OPENCODE_VERSION=1.18.35-mejai.1 and OPENCODE_CHANNEL=mejai. Leave OPENCODE_RELEASE unset (it enables publishing). Run:\n\n\`\`\`sh\nbun script/build.ts --target=opencode-linux-x64-baseline --skip-embed-web-ui\n# or Windows x64:\nbun script/build.ts --target=opencode-windows-x64 --skip-embed-web-ui\n\`\`\`\n\nThe Hub serves its own UI. The binary is emitted under packages/opencode/dist/<target>/bin/. Use bundled release runtimes alongside mejai/ to run the Hub; source alone is not a portable runtime. See mejai/release/build-packages.mjs for the release preparation, exclusions and fresh configuration policy. Run the Hub regression suite with node mejai/testes/executar.mjs; Node/runtime dependencies are needed. Unit packaging checks: node --test mejai/release/package-policy.test.mjs. Native Python checks: bun test test/tool/python.test.ts from packages/opencode.\n\nUpstream automation workflows are retained under docs/upstream-workflows and are inactive by default so a new fork does not publish upstream deployment jobs on its first push. Upstream README is preserved under docs/UPSTREAM-README.md.\n\n## Public distributions\n\nWindows x64 ZIP; Linux x64 tar.xz (tested Ubuntu 26.04 via WSL); source ZIP. First launch has no chats, accounts, model selection or user files. Ollama and model weights are installed separately. Official upstream updates are disabled; upgrades must preserve this fork and back up existing user data.\n`,
);
console.log(
  "Source staged: " + tracked.length + " tracked files plus native patches and Hub source",
);
console.log("Staging: " + staging);
