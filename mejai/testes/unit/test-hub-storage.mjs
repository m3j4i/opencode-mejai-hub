import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  storeUpload,
  readAttachment,
  MAX_UPLOAD,
} from "../../src/repositories/attachment-repository.mjs";
import { scanLanguages } from "../../src/repositories/language-repository.mjs";
test("attachments preserve bytes, sanitize names and isolate conversations", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hub-upload-"));
  try {
    const bytes = Buffer.from("uploaded content");
    const item = await storeUpload(root, "ses_test", "metadata.json", [bytes]);
    assert.equal(
      await fs.readFile((await readAttachment(root, "ses_test", item.id)).file, "utf8"),
      "uploaded content",
    );
    assert(!item.name.includes("/"));
    await assert.rejects(readAttachment(root, "ses_other", item.id));
    await assert.rejects(readAttachment(root, "ses_test", "../../outside"));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("oversized upload fails and does not leave a partial file", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hub-upload-"));
  try {
    await assert.rejects(
      storeUpload(root, "ses_test", "large.bin", [Buffer.alloc(MAX_UPLOAD + 1)]),
      /50 MB/,
    );
    assert.deepEqual(await fs.readdir(path.join(root, "tarefas/anexos/ses_test")), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("language scan discovers additions and reports malformed files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hub-language-"));
  try {
    await fs.mkdir(path.join(root, "linguagens"));
    await fs.writeFile(
      path.join(root, "linguagens/en.language"),
      JSON.stringify({ name: "English", strings: { Save: "Save" } }),
    );
    assert.equal((await scanLanguages(root)).languages.length, 1);
    await fs.writeFile(
      path.join(root, "linguagens/pt-BR.language"),
      JSON.stringify({ name: "Português", strings: { Save: "Salvar" } }),
    );
    await fs.writeFile(path.join(root, "linguagens/broken.language"), "{");
    const result = await scanLanguages(root);
    assert.equal(result.languages.length, 2);
    assert.equal(result.errors.length, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
