import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { storeUpload } from "../../src/repositories/attachment-repository.mjs";
import { attachmentParts } from "../../src/services/attachment-service.mjs";
test("images use native model input only when declared, other files stay available to tools", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hub-parts-"));
  try {
    const config = {
      model: "local/example",
      provider: { local: { models: { example: { modalities: { input: ["text"] } } } } },
    };
    await fs.writeFile(path.join(root, "opencode.json"), JSON.stringify(config));
    const picture = await storeUpload(root, "ses_test", "photo.png", [
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ]);
    const archive = await storeUpload(root, "ses_test", "spreadsheet.xlsx", [
      Buffer.from("PK fixture"),
    ]);
    let parts = await attachmentParts(root, "ses_test", [picture.id, archive.id]);
    assert.equal(parts.filter((part) => part.type === "file").length, 0);
    assert.match(parts[0].text, /no declared image input/);
    assert.match(parts[1].text, /spreadsheet.xlsx/);
    config.provider.local.models.example.modalities.input.push("image");
    await fs.writeFile(path.join(root, "opencode.json"), JSON.stringify(config));
    parts = await attachmentParts(root, "ses_test", [picture.id]);
    assert.equal(parts[1].type, "file");
    assert.match(parts[1].url, /^file:/);
    await assert.rejects(
      attachmentParts(root, "ses_test", [picture.id, picture.id]),
      /different files/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
