import {
  readCamoufoxProfile,
  saveCamoufoxProfile,
} from "../repositories/camoufox-profile-repository.mjs";
import { browserPolicy, guardOnionTraffic } from "./browser-policy.mjs";
import { runtime, windows } from "../../platform.mjs";
import { pathToFileURL } from "node:url";
export async function launchBrowser(base, settings, chromium) {
  const { proxy, engine, headless, profile } = browserPolicy(base, settings, process.env, windows);
  if (engine === "camoufox") {
    process.env.CAMOUFOX_INSTALL_DIR = runtime("camoufox-engine");
    const load = (modulePath) =>
      import(pathToFileURL(runtime("camoufox/node_modules", modulePath)));
    const { launchOptions } = await load("camoufox-js/dist/index.js");
    const { firefox } = await load("playwright-core/index.mjs");
    const { known, version, saved, configPath } = await readCamoufoxProfile(
      profile,
      process.env.CAMOUFOX_INSTALL_DIR,
    );
    // The JS client still emits fields removed from newer engines. Keep the
    // engine's own schema as the source of truth; never modify vendor packages.
    const obsolete = new Set([
      "navigator.appCodeName",
      "navigator.appName",
      "navigator.product",
      "screen.pageXOffset",
      "screen.pageYOffset",
      "battery:charging",
      "battery:chargingTime",
      "battery:dischargingTime",
      "window.history.length",
      "canvas:aaOffset",
      "canvas:aaCapOffset",
    ]);
    const config = new Proxy(
      Object.fromEntries(Object.entries(saved).filter(([propertyName]) => known.has(propertyName))),
      {
        set(targetConfig, key, value) {
          if (known.has(key)) targetConfig[key] = value;
          else if (!obsolete.has(key)) throw Error("Camoufox: unknown property " + String(key));
          return true;
        },
      },
    );
    const options = await launchOptions({
      config,
      i_know_what_im_doing: true,
      os: windows ? "windows" : "linux",
      headless,
      humanize: settings.humanize !== false,
      enable_cache: true,
      exclude_addons: ["UBO"],
      ...(proxy
        ? {
            proxy: { server: proxy },
            block_webrtc: true,
            firefox_user_prefs: {
              "network.proxy.socks_remote_dns": true,
              "network.trr.mode": 5,
              "network.dns.disablePrefetch": true,
              "network.prefetch-next": false,
              "media.peerconnection.enabled": false,
              "media.navigator.enabled": false,
            },
          }
        : {}),
    });
    const context = await firefox.launchPersistentContext(profile, {
      ...options,
      // The installed JS client serializes SOCKS URL.origin as null. Preserve the validated endpoint.
      ...(proxy ? { proxy: { server: proxy } } : {}),
      acceptDownloads: true,
      serviceWorkers: "block",
      viewport: null,
    });
    try {
      await saveCamoufoxProfile(configPath, version, config);
    } catch (error) {
      await context.close();
      throw error;
    }
    await guardOnionTraffic(context, proxy);
    return context;
  }
  if (engine !== "chromium") throw Error("Unknown browser engine: " + engine);
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: settings.executablePath,
    headless,
    acceptDownloads: true,
    serviceWorkers: "block",
    viewport: { width: 1440, height: 900 },
    ...(proxy ? { proxy: { server: proxy } } : {}),
    args: [
      "--disable-notifications",
      ...(proxy
        ? [
            "--disable-quic",
            "--disable-background-networking",
            "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
            "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
          ]
        : []),
    ],
  });
  await guardOnionTraffic(context, proxy);
  return context;
}
