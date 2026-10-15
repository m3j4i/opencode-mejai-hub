import test from "node:test";
import assert from "node:assert/strict";
import { includeRuntimeFile, cleanConfig, safeRelativePath } from "./package-policy.mjs";

test("private state, models and cached backups never ship", () => {
  for (const platform of ["windows", "linux"])
    for (const filename of [
      "dados/session.db",
      "logs/user.log",
      "downloads/private.pdf",
      "tarefas/script.py",
      "models/private.bin",
      "navegador-camoufox/cookies.sqlite",
      "runtime/mejai-updates/backup/config.json",
      "runtime/versoes-codigo/private.mjs",
      "runtime/python/.env",
      "runtime/essenciais/node_modules/pkg/.npmrc",
    ])
      assert(!includeRuntimeFile(filename, platform), filename);
});
test("runtimes are separated and nested application modules are preserved", () => {
  assert(includeRuntimeFile("runtime/node/node.exe", "windows"));
  assert(!includeRuntimeFile("runtime/node/node.exe", "linux"));
  assert(includeRuntimeFile("runtime/linux/node/bin/node", "linux"));
  assert(!includeRuntimeFile("runtime/linux/node/bin/node", "windows"));
  for (const platform of ["windows", "linux"]) {
    assert(includeRuntimeFile("src/services/script-artifact-service.mjs", platform));
    assert(includeRuntimeFile("ui/chat/markdown.js", platform));
    assert(includeRuntimeFile("runtime/ui/lib/marked.esm.js", platform));
  }
  assert(
    !includeRuntimeFile(
      "runtime/camoufox-engine/installation_dir_layout/versioned/old/camoufox.exe",
      "windows",
    ),
  );
  assert(includeRuntimeFile("runtime/ocr/Lib/site-packages/rapidocr/models/det.onnx", "windows"));
  assert(!includeRuntimeFile("runtime/linux/python/lib/tool.exe", "linux"));
});
test("relative paths cannot escape staging", () => {
  for (const filename of ["../secret", "a/../b", "C:/secret", "/absolute", "a//b"])
    assert(!safeRelativePath(filename));
  assert(safeRelativePath("ui/chat/markdown.js"));
});
test("public config is fresh, keeps rules and disables official upgrades", () => {
  const original = {
    unknownPrivateSetting: "secret",
    model: "private/model",
    small_model: "private/model",
    provider: { private: { options: { apiKey: "secret" } } },
    mcp: { private: { command: ["C:/private"] } },
    plugin: ["file:///C:/private/plugin.mjs"],
  };
  const clean = cleanConfig(original);
  assert(!clean.model && !clean.small_model);
  assert.equal(clean.autoupdate, false);
  assert.deepEqual(clean.provider.ollama.models, {});
  assert.deepEqual(clean.mcp, {});
  assert(!Object.hasOwn(clean, "plugin"), "Do not override generated runtime plugins");
  assert(!JSON.stringify(clean).includes("secret"));
  assert.equal(original.model, "private/model");
});

test("machine-specific dependency markers and optional geolocation data are excluded", () => {
  for (const filename of [
    "runtime/linux/browsers/.links/machine",
    "runtime/linux/ready.json",
    "runtime/linux/python-managed/.lock",
    "runtime/linux/camoufox-engine/GeoLite2-City.mmdb",
  ])
    assert(!includeRuntimeFile(filename, "linux"));
});

test("only the vendor WebGL fingerprint database can ship", () => {
  assert(
    includeRuntimeFile(
      "runtime/camoufox/node_modules/camoufox-js/dist/data-files/webgl_data.db",
      "windows",
    ),
  );
  assert(
    includeRuntimeFile(
      "runtime/linux/camoufox/node_modules/camoufox-js/dist/data-files/webgl_data.db",
      "linux",
    ),
  );
  assert(!includeRuntimeFile("runtime/camoufox/chat.db", "windows"));
});
