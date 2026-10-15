import path from "node:path";
import net from "node:net";

export async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export function isLegacyServer(config, root) {
  return (
    !config.instructions?.includes(path.join(root, "LANGUAGE.md")) ||
    !config.provider?.colibri ||
    !config.plugin?.some((entry) => {
      const name = Array.isArray(entry) ? entry[0] : entry;
      return typeof name === "string" && name.endsWith("/autonomy.mjs");
    })
  );
}

// The engine reads project config after OPENCODE_CONFIG. Pin bundled plugins in
// its final inline layer so a portable package's plugin: [] cannot remove them.
export function runtimeConfigContent(config, inherited) {
  const overrides = inherited ? JSON.parse(inherited) : {};
  if (!overrides || Array.isArray(overrides) || typeof overrides !== "object")
    throw Error("OPENCODE_CONFIG_CONTENT must contain a JSON object.");
  return JSON.stringify({ ...overrides, plugin: config.plugin });
}

// Share only in-flight work; subsequent calls must still check server health.
export function singleStartup(start) {
  let pending;
  return function () {
    if (pending) return pending;
    pending = Promise.resolve()
      .then(start)
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
