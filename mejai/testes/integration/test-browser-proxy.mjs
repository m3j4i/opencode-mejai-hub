import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import assert from "node:assert/strict";
import { pathToFileURL, fileURLToPath } from "node:url";
const base =
  process.env.AGENTE_LOCAL_HOME ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { launchBrowser } = await import(pathToFileURL(path.join(base, "browser-engine.mjs")));
const root = await fs.mkdtemp(path.join(os.tmpdir(), "mejai-proxy-test-"));
const requests = [],
  sockets = new Set();
const proxy = net.createServer((socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  socket.on("error", () => {});
  let state = "greeting",
    buffer = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (state === "greeting") {
      if (buffer.length < 2 + buffer[1]) return;
      buffer = buffer.subarray(2 + buffer[1]);
      socket.write(Buffer.from([5, 0]));
      state = "request";
    }
    if (state === "request") {
      if (buffer.length < 5) return;
      const length = buffer[3] === 3 ? buffer[4] : 4;
      const offset = buffer[3] === 3 ? 5 : 4;
      if (buffer.length < offset + length + 2) return;
      const hostname = buffer.subarray(offset, offset + length).toString();
      requests.push({ hostname, type: buffer[3] });
      if (hostname !== "camoufox-test.onion") {
        socket.end(Buffer.from([5, 2, 0, 1, 0, 0, 0, 0, 0, 0]));
        return;
      }
      socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 80]));
      buffer = buffer.subarray(offset + length + 2);
      state = "http";
    }
    if (state === "http" && buffer.includes(Buffer.from("\r\n\r\n"))) {
      const body = "<html><body><h1>Through SOCKS only</h1></body></html>";
      socket.end(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: " +
          Buffer.byteLength(body) +
          "\r\nConnection: close\r\n\r\n" +
          body,
      );
    }
  });
});
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
const original = { ...process.env };
let browser;
try {
  process.env.AGENTE_BROWSER_PROXY = "socks5://127.0.0.1:" + proxy.address().port;
  process.env.AGENTE_BROWSER_ENGINE = "camoufox";
  process.env.AGENTE_BROWSER_HEADLESS = "1";
  browser = await launchBrowser(root, { engine: "camoufox", humanize: false }, null);
  const page = await browser.newPage();
  await page.goto("http://camoufox-test.onion", { timeout: 20000 });
  assert.equal(await page.locator("h1").textContent(), "Through SOCKS only");
  assert(
    requests.some((request) => request.hostname === "camoufox-test.onion" && request.type === 3),
  );
  assert.equal(await page.evaluate(() => typeof RTCPeerConnection), "undefined");
  console.log(
    "PASS real Camoufox SOCKS routing, remote hostname resolution, separate profile and disabled WebRTC. Local fake proxy; no Tor external access claimed.",
  );
} finally {
  await browser?.close();
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => proxy.close(resolve));
  for (const name of ["AGENTE_BROWSER_PROXY", "AGENTE_BROWSER_ENGINE", "AGENTE_BROWSER_HEADLESS"]) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
  const resolved = path.resolve(root);
  if (
    path.dirname(resolved) === path.resolve(os.tmpdir()) &&
    path.basename(resolved).startsWith("mejai-proxy-test-")
  )
    await fs.rm(resolved, { recursive: true, force: true });
}
