import assert from "node:assert/strict";
import path from "node:path";
import {
  runtimeConfigContent,
  singleStartup,
  isLegacyServer,
} from "../../src/services/startup-service.mjs";

const identity = {
  instructions: [path.join("kit", "LANGUAGE.md")],
  provider: { colibri: {} },
  plugin: ["file:///kit/plugins/autonomy.mjs"],
};
assert.equal(isLegacyServer(identity, "kit"), false);
assert.equal(isLegacyServer({ ...identity, plugin: [] }, "kit"), true);
assert.equal(isLegacyServer({ ...identity, plugin: [[identity.plugin[0], {}]] }, "kit"), false);
assert.equal(isLegacyServer({ ...identity, plugin: [null, {}] }, "kit"), true);

const config = { plugin: ["file:///kit/plugins/autonomy.mjs"] };
assert.deepEqual(JSON.parse(runtimeConfigContent(config)), config);
const inherited = JSON.stringify({
  plugin: [],
  model: "local/model",
  permission: { task: "deny" },
});
assert.deepEqual(JSON.parse(runtimeConfigContent(config, inherited)), {
  plugin: config.plugin,
  model: "local/model",
  permission: { task: "deny" },
});
assert.deepEqual(config, { plugin: ["file:///kit/plugins/autonomy.mjs"] });
for (const invalid of ["null", "[]", "false", "broken"])
  assert.throws(() => runtimeConfigContent(config, invalid));

let calls = 0;
let finish;
const start = singleStartup(() => {
  calls++;
  return new Promise((resolve) => {
    finish = resolve;
  });
});
const first = start();
const concurrent = start();
assert.equal(first, concurrent);
await Promise.resolve();
assert.equal(calls, 1);
finish({ pid: 42 });
assert.deepEqual(await concurrent, { pid: 42 });
const next = start();
await Promise.resolve();
assert.equal(calls, 2);
finish({ pid: 43 });
assert.deepEqual(await next, { pid: 43 });

let attempts = 0;
const retry = singleStartup(() => {
  if (++attempts === 1) throw Error("fixture startup failure");
  return { pid: 44 };
});
await assert.rejects(retry(), /fixture startup failure/);
assert.deepEqual(await retry(), { pid: 44 });
console.log(
  "PASS startup: inline plugin precedence, concurrent calls, health rechecks and failure retry.",
);
