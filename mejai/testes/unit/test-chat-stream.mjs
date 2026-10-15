import test from "node:test";
import assert from "node:assert/strict";
import { createStream } from "../../ui/chat/stream.js";
test("thinking deltas append to the correct historical message", async () => {
  const records = new Map();
  let paints = 0;
  const context = {
    state: { records, drawTimer: null },
    refresh() {
      throw Error("Unexpected snapshot fallback");
    },
    renderMessages() {
      paints++;
    },
  };
  const stream = createStream(context);
  stream.applyStreamEvent({
    type: "message.updated",
    properties: { info: { id: "old", role: "assistant" } },
  });
  stream.applyStreamEvent({
    type: "message.part.updated",
    properties: {
      part: { id: "old-part", messageID: "old", type: "reasoning", text: "Past thought" },
    },
  });
  stream.applyStreamEvent({
    type: "message.updated",
    properties: { info: { id: "new", role: "assistant" } },
  });
  stream.applyStreamEvent({
    type: "message.part.updated",
    properties: { part: { id: "new-part", messageID: "new", type: "reasoning", text: "Live " } },
  });
  stream.applyStreamEvent({
    type: "message.part.delta",
    properties: { partID: "new-part", field: "text", delta: "thinking" },
  });
  assert.equal(records.get("new").parts[0].text, "Live thinking");
  assert.equal(records.get("old").parts[0].text, "Past thought");
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(paints, 1, "batch DOM updates during streaming");
});
