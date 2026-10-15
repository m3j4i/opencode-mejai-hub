import path from "node:path";

export function browserPolicy(base, settings, environment, windows) {
  const proxy = environment.AGENTE_BROWSER_PROXY;
  const engine = environment.AGENTE_BROWSER_ENGINE || settings.engine || "chromium";
  if (!["chromium", "camoufox"].includes(engine)) throw Error("Unknown browser engine: " + engine);
  if (proxy && !/^socks5h?:\/\/127\.0\.0\.1:\d+$/.test(proxy))
    throw Error("Tor browser requires a local SOCKS5 proxy.");
  const headless =
    environment.AGENTE_BROWSER_HEADLESS === undefined
      ? settings.headless !== false
      : environment.AGENTE_BROWSER_HEADLESS === "1";
  // Proxy browsing never borrows the clearnet cookie/profile directory.
  const profile = proxy
    ? path.join(base, "dados/tor-browser", engine)
    : environment.AGENTE_TEST_PROFILE ||
      environment.AGENTE_BROWSER_PROFILE ||
      (windows
        ? path.join(base, engine === "camoufox" ? "navegador-camoufox" : "navegador")
        : path.join(base, "dados/browser-linux", engine));
  return { engine, headless, profile, proxy: proxy?.replace("socks5h:", "socks5:") };
}

export function isOnion(address) {
  try {
    const hostname = new URL(address).hostname.toLowerCase();
    return hostname === "onion" || hostname.endsWith(".onion");
  } catch {
    return false;
  }
}

export async function guardOnionTraffic(context, proxy) {
  if (proxy) return;
  await context.route("**/*", (route) =>
    isOnion(route.request().url()) ? route.abort("blockedbyclient") : route.continue(),
  );
}
