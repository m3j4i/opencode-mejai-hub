import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { copyRuntime } from "./copy-service.mjs";

test("distribution copying retains nested tools and never changes installed conversations", async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "mejai-release-test-"));
  const installed = path.join(fixture, "installed");
  const target = path.join(fixture, "clean");
  try {
    for (const relative of [
      "dados/chat.db",
      "downloads/private.txt",
      "runtime/node/node.exe",
      "runtime/linux/node/bin/node",
      "ui/chat/markdown.js",
      "runtime/python/Lib/site-packages/module/package.json",
    ]) {
      const file = path.join(installed, relative);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, relative);
    }
    await copyRuntime(installed, target, "windows");
    assert.equal(await fs.readFile(path.join(installed, "dados/chat.db"), "utf8"), "dados/chat.db");
    await assert.rejects(fs.access(path.join(target, "dados")));
    await assert.rejects(fs.access(path.join(target, "downloads")));
    await assert.rejects(fs.access(path.join(target, "runtime/linux")));
    assert.equal(
      await fs.readFile(path.join(target, "ui/chat/markdown.js"), "utf8"),
      "ui/chat/markdown.js",
    );
    await fs.access(path.join(target, "runtime/python/Lib/site-packages/module/package.json"));
  } finally {
    if (
      path.dirname(fixture) === path.resolve(os.tmpdir()) &&
      path.basename(fixture).startsWith("mejai-release-test-")
    )
      await fs.rm(fixture, { recursive: true, force: true });
  }
});
