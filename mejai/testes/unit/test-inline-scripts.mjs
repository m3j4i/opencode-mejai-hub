import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scriptArtifacts } from "../../src/services/script-artifact-service.mjs";
import {
  readScriptArtifact,
  MAX_SCRIPT_BYTES,
} from "../../src/repositories/script-artifact-repository.mjs";

const user = (text) => ({ info: { role: "user" }, parts: [{ type: "text", text }] });
const write = (filename, content, status = "completed") => ({
  info: { role: "assistant" },
  parts: [
    { type: "tool", tool: "write", state: { status, input: { filePath: filename, content } } },
  ],
});
const answer = (text) => ({
  info: { id: "final", role: "assistant", finish: "stop" },
  parts: [{ type: "text", text }],
});
test("path-only delivery shows the complete recorded script without accessing arbitrary paths", async () => {
  const code = 'print("hello")\n';
  const result = await scriptArtifacts(
    [user("Create a Python script"), write("/tasks/test.py", code), answer("Saved /tasks/test.py")],
    "/tasks",
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].text, code);
  assert.equal(result[0].source, "recorded-write");
  assert.equal(result[0].language, "python");
});
test("existing full code is not duplicated; unknown paths and failed writes are not read", async () => {
  const code = 'print("test")';
  assert.equal(
    (
      await scriptArtifacts(
        [write("test.py", code), answer("test.py\n```python\n" + code + "\n```")],
        "/tasks",
      )
    ).length,
    0,
  );
  assert.equal(
    (
      await scriptArtifacts([answer("/private/unrecorded.py")], "/tasks", () => {
        throw Error("Must not read");
      })
    ).length,
    0,
  );
  assert.equal(
    (await scriptArtifacts([write("test.py", code, "error"), answer("test.py")], "/tasks")).length,
    0,
  );
});
test("new requests isolate artifacts, automated continuations preserve them, explicit omission is respected", async () => {
  assert.equal(
    (await scriptArtifacts([write("old.py", "pass"), user("New task"), answer("old.py")], "/tasks"))
      .length,
    0,
  );
  assert.equal(
    (
      await scriptArtifacts(
        [
          user("Create a script"),
          write("test.py", "pass"),
          user("[MEJAI autonomy] Continue"),
          answer("test.py"),
        ],
        "/tasks",
      )
    ).length,
    1,
  );
  assert.equal(
    (
      await scriptArtifacts(
        [user("Mostre apenas o caminho"), write("test.py", "pass"), answer("test.py")],
        "/tasks",
      )
    ).length,
    0,
  );
});
test("large recorded scripts are explicitly omitted, never silently truncated", async () => {
  const result = await readScriptArtifact(
    { kind: "write", filePath: "large.py", content: "x".repeat(MAX_SCRIPT_BYTES + 1) },
    "/tasks",
  );
  assert.equal(result.status, "too_large");
  assert.equal(result.text, undefined);
});
test("edited scripts use validated current file contents; missing files do not break chat", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mejai-inline-script-"));
  try {
    await fs.writeFile(path.join(directory, "edited.py"), 'print("edited")\n');
    const result = await readScriptArtifact({ kind: "edit", filePath: "edited.py" }, directory);
    assert.equal(result.text, 'print("edited")\n');
    assert.equal(result.source, "current-file");
    assert.equal(
      (await readScriptArtifact({ kind: "edit", filePath: "missing.py" }, directory)).status,
      "unavailable",
    );
  } finally {
    const resolved = path.resolve(directory);
    if (
      path.dirname(resolved) === path.resolve(os.tmpdir()) &&
      path.basename(resolved).startsWith("mejai-inline-script-")
    )
      await fs.rm(resolved, { recursive: true, force: true });
  }
});

test("unrelated filename suffixes do not display another script", async () => {
  assert.equal(
    (await scriptArtifacts([write("/tasks/test.py", "pass"), answer("other-test.py")], "/tasks"))
      .length,
    0,
  );
});
