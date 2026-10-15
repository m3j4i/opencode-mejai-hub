import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { applyUpdate } from "./apply-update.mjs";

test("maintenance update verifies files, preserves personal config and saves original files", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mejai-update-test-"));
  const root = path.join(directory, "kit");
  const bundle = path.join(directory, "bundle");
  await fs.mkdir(root);
  await fs.mkdir(path.join(bundle, "payload/src/services"), { recursive: true });
  const release = { version: "old", engineVersion: "1.18.35-mejai.1", platform: "windows" };
  await fs.writeFile(path.join(root, "release.json"), JSON.stringify(release));
  await fs.writeFile(path.join(root, "mejai-controller.mjs"), "old controller");
  await fs.writeFile(path.join(root, "opencode.json"), "personal configuration");
  const files = {
    "mejai-controller.mjs": "fixed controller",
    "src/services/startup-service.mjs": "startup helper",
    "release.json": JSON.stringify({ ...release, version: "1.18.35-mejai.1-hub.20261015" }),
  };
  const manifest = {
    version: "1.18.35-mejai.1-hub.20261015",
    engineVersion: release.engineVersion,
    files: Object.fromEntries(
      Object.entries(files).map(([name, content]) => [
        name,
        createHash("sha256").update(content).digest("hex"),
      ]),
    ),
  };
  try {
    for (const [name, content] of Object.entries(files))
      await fs.writeFile(path.join(bundle, "payload", name), content);
    await fs.writeFile(path.join(bundle, "manifest.json"), JSON.stringify(manifest));
    await fs.writeFile(path.join(bundle, "payload/mejai-controller.mjs"), "tampered");
    await assert.rejects(applyUpdate(root, bundle), /Checksum mismatch/);
    assert.equal(
      await fs.readFile(path.join(root, "mejai-controller.mjs"), "utf8"),
      "old controller",
    );
    await fs.writeFile(
      path.join(bundle, "payload/mejai-controller.mjs"),
      files["mejai-controller.mjs"],
    );
    const updated = await applyUpdate(root, bundle);
    assert.equal(
      await fs.readFile(path.join(root, "opencode.json"), "utf8"),
      "personal configuration",
    );
    assert.equal(
      await fs.readFile(path.join(updated.backup, "mejai-controller.mjs"), "utf8"),
      "old controller",
    );
    assert.equal(
      await fs.readFile(path.join(root, "mejai-controller.mjs"), "utf8"),
      "fixed controller",
    );
    manifest.files["../outside"] = "invalid";
    await fs.writeFile(path.join(bundle, "manifest.json"), JSON.stringify(manifest));
    await assert.rejects(applyUpdate(root, bundle), /Incomplete update/);
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith("mejai-update-test-"));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
