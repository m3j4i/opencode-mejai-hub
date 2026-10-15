import fs from "node:fs/promises";
import path from "node:path";

export const engineVersion = "1.18.35-mejai.1";
export const releaseVersion = engineVersion + "-hub.20261014";
export async function writeReleaseDocuments(destination, platform) {
  const manifest = {
    version: releaseVersion,
    engineVersion,
    platform,
    architecture: "x86_64",
    upstream: "https://github.com/anomalyco/opencode",
    upstreamCommit: "53d1eabb61e21162157817bf677da0a4ad3332e3",
    state: "fresh",
    bundledModels: false,
    automaticUpstreamUpdates: false,
  };
  await fs.writeFile(
    path.join(destination, "release.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  const start =
    platform === "windows"
      ? "Extract the entire 7z archive with 7-Zip or a compatible extractor, then double-click Iniciar.cmd."
      : "Extract with tar -xJf, then run ./start.sh. Do not extract the Linux archive with Windows Explorer: preserve symbolic links and executable permissions.";
  await fs.writeFile(
    path.join(destination, "README.md"),
    `# OpenCode (mejai hub)\n\nVersion ${releaseVersion}; ${platform} x86_64.\n\n${start}\n\nInstall and start Ollama separately, download a model, then select it in the Hub. No model weights, accounts, conversations or personal files are included. Colibri is available for manual configuration and starts disabled. Keep the entire directory together and place it in a writable folder. Local session data is created inside dados/ when you use the application.\n\nThe Linux package was validated on Ubuntu 26.04 x86_64 through WSL. It bundles libraries from that distribution; compatibility with older distributions, ARM and Alpine is not claimed. Windows was validated on Windows x64.\n\nThe native fork includes the Python tool and blocks replacing this fork with official upstream updates. Use a new release in a separate directory and back up your dados/ directory before migrating existing sessions. Never overwrite a working installation blindly.\n\nSource and build instructions are provided in the separate source archive. See THIRD-PARTY-NOTICES.md and licenses included in runtime directories.\n\n## Português\n\nExtraia tudo antes de iniciar. Windows: abra Iniciar.cmd. Linux: extraia com tar e execute ./start.sh. Instale o Ollama separadamente e selecione um modelo no Hub. O pacote inicia sem chats, contas ou modelo selecionado. Colibri fica desativado até ser configurado. Os dados locais serão criados na pasta dados/. Linux foi validado no Ubuntu 26.04 x64 via WSL.\n`,
  );
  await fs.writeFile(
    path.join(destination, "THIRD-PARTY-NOTICES.md"),
    `# Included software\n\nOpenCode and first-party Mejai additions: MIT; see LICENSE. Original upstream: https://github.com/anomalyco/opencode/tree/53d1eabb61e21162157817bf677da0a4ad3332e3 . The separate source archive contains this fork's modified source.\n\nRuntime package metadata and license files are preserved. Third-party code keeps its own licenses. runtime-packages.json inventories Node and Python dependency versions.\n\n- Node.js 24.18.0: MIT and included notices; https://nodejs.org/dist/v24.18.0/ (corresponding source: node-v24.18.0.tar.gz).\n- Python 3.13: PSF and bundled notices; https://www.python.org/downloads/source/ . Linux portable builds: https://github.com/astral-sh/python-build-standalone/releases .\n- Camoufox: MPL-2.0 and included notices; https://github.com/daijro/camoufox/releases . Application version is recorded in runtime metadata. Corresponding build sources: https://github.com/daijro/camoufox and https://github.com/daijro/camoufox/releases . The optional GeoLite2 database is omitted.\n- Chromium / Playwright: bundled Chromium notices and Playwright Apache-2.0; https://github.com/microsoft/playwright .\n- Colibri: Apache-2.0; https://github.com/JustVugg/colibri . See the bundled LICENSE and source metadata.\n- Tor: BSD-3-Clause (Tor itself) and individual bundled-library licenses; Windows expert bundle 15.0.24 / Tor 0.4.9.13: https://dist.torproject.org/torbrowser/15.0.24/ . Linux distribution license texts remain in runtime/linux/system-libs/usr/share/doc/.\n- 7-Zip: LGPL plus unRAR restriction where applicable; https://www.7-zip.org/ .\n- FFmpeg: see the exact build configuration and bundled license. Source: https://ffmpeg.org/download.html ; static builds: https://github.com/eugeneware/ffmpeg-static and https://github.com/BtbN/FFmpeg-Builds/releases .\n- PowerShell (Windows): MIT and bundled third-party notices; https://github.com/PowerShell/PowerShell .\n- Git (Windows): GPL-2.0 and bundled notices; https://github.com/git-for-windows/git/releases .\n- Serena: MIT; https://github.com/oraios/serena .\n- marked: MIT; runtime/ui/lib/ contains its license.\n\nNo third-party trademarks imply endorsement. No model weights are redistributed.\n`,
  );
}

export async function inventoryPackages(root) {
  const records = [];
  async function visit(folder) {
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await visit(file);
      else if (entry.name === "package.json") {
        try {
          const metadata = JSON.parse(await fs.readFile(file, "utf8"));
          if (metadata.name && metadata.version)
            records.push({
              path: path.relative(root, file).replaceAll("\\", "/"),
              name: metadata.name,
              version: metadata.version,
              license: metadata.license || null,
              repository: metadata.repository || null,
            });
        } catch {}
      } else if (entry.name === "METADATA" && folder.endsWith(".dist-info")) {
        const text = await fs.readFile(file, "utf8");
        records.push({
          path: path.relative(root, file).replaceAll("\\", "/"),
          name: text.match(/^Name: (.+)$/m)?.[1],
          version: text.match(/^Version: (.+)$/m)?.[1],
          license: text.match(/^License(?:-Expression)?: (.+)$/m)?.[1] || null,
        });
      }
    }
  }
  await visit(path.join(root, "runtime"));
  await fs.writeFile(
    path.join(root, "runtime-packages.json"),
    JSON.stringify(records, null, 2) + "\n",
  );
  return records.length;
}
