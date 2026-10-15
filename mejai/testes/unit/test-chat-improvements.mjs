import test from "node:test";
import assert from "node:assert/strict";
import { shouldSend } from "../../ui/chat/input.js";
import { safeLink } from "../../ui/chat/markdown.js";
import { editMessage } from "../../src/services/edit-workflow.mjs";
import { browserPolicy, isOnion } from "../../src/services/browser-policy.mjs";

test("Enter sends, modifiers, IME and repeated keys do not", () => {
  assert(shouldSend({ key: "Enter" }));
  for (const field of ["shiftKey", "altKey", "ctrlKey", "metaKey", "isComposing", "repeat"])
    assert(!shouldSend({ key: "Enter", [field]: true }));
  assert(!shouldSend({ key: "Enter", keyCode: 229 }));
  assert(!shouldSend({ key: "a" }));
});
test("unsafe Markdown links cannot execute code or expose file URLs", () => {
  for (const address of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///C:/secret",
    "https://user:pass@example.com",
    "\njavascript:alert(1)",
  ])
    assert.equal(safeLink(address), null);
  assert.equal(safeLink("https://example.org/path"), "https://example.org/path");
});
function fixture(overrides = {}) {
  const calls = [];
  const message = {
    info: { role: "user" },
    parts: [
      { type: "text", text: "Original" },
      { type: "text", text: "Attachment path", metadata: { mejaiAttachment: {} } },
    ],
  };
  return {
    calls,
    repository: {
      async assertIdle() {},
      async message() {
        return message;
      },
      async attachments() {
        return [message.parts[1]];
      },
      async fork(...args) {
        calls.push(["fork", ...args]);
        return { id: "branch" };
      },
      async submit(...args) {
        calls.push(["submit", ...args]);
      },
      ...overrides,
    },
  };
}
const input = {
  sessionID: "original",
  messageID: "msg_test",
  text: " Corrected ",
  expectedText: "Original",
};
test("editing forks BEFORE target and submits only to new conversation with attachments", async () => {
  const { repository, calls } = fixture();
  assert.deepEqual(await editMessage(repository, input), { sessionID: "branch", sent: true });
  assert.deepEqual(calls[0], ["fork", "original", "msg_test"]);
  assert.equal(calls[1][1], "branch");
  assert.equal(calls[1][3], "Corrected");
  assert.equal(calls[1][4].length, 1);
});
test("busy, stale and assistant messages do not create branches", async () => {
  for (const overrides of [
    {
      async assertIdle() {
        throw Error("busy");
      },
    },
    {
      async message() {
        return { info: { role: "assistant" }, parts: [] };
      },
    },
  ]) {
    const { repository, calls } = fixture(overrides);
    await assert.rejects(editMessage(repository, input));
    assert.equal(calls.length, 0);
  }
  const { repository, calls } = fixture();
  await assert.rejects(editMessage(repository, { ...input, expectedText: "Stale" }), /changed/);
  assert.equal(calls.length, 0);
});
test("failed admission retains branch and never automatically resends", async () => {
  let submissions = 0;
  const { repository } = fixture({
    async submit() {
      submissions++;
      throw Error("timeout");
    },
  });
  const result = await editMessage(repository, input);
  assert.equal(result.sessionID, "branch");
  assert.equal(result.sent, false);
  assert.equal(submissions, 1);
});
test("silent defaults, explicit visible mode and Tor profile isolation", () => {
  assert(browserPolicy("/kit", { engine: "camoufox" }, {}, false).headless);
  assert(!browserPolicy("/kit", {}, { AGENTE_BROWSER_HEADLESS: "0" }, false).headless);
  const policy = browserPolicy(
    "/kit",
    { engine: "camoufox" },
    { AGENTE_BROWSER_PROXY: "socks5h://127.0.0.1:9050", AGENTE_BROWSER_PROFILE: "/clearnet" },
    false,
  );
  assert.equal(policy.engine, "camoufox");
  assert(policy.profile.includes("tor-browser"));
  assert(!policy.profile.includes("clearnet"));
  assert.equal(policy.proxy, "socks5://127.0.0.1:9050");
  assert.throws(() =>
    browserPolicy("/kit", {}, { AGENTE_BROWSER_PROXY: "https://example.org" }, false),
  );
  assert(isOnion("http://subdomain.example.onion/path"));
  assert(!isOnion("https://onion.example.com"));
});
