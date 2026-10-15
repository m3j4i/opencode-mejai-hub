# Included software

OpenCode and first-party Mejai additions: MIT; see LICENSE. Original upstream: https://github.com/anomalyco/opencode/tree/53d1eabb61e21162157817bf677da0a4ad3332e3 . The separate source archive contains this fork's modified source.

Runtime package metadata and license files are preserved. Third-party code keeps its own licenses. runtime-packages.json inventories Node and Python dependency versions.

- Node.js 24.18.0: MIT and included notices; https://nodejs.org/dist/v24.18.0/ (corresponding source: node-v24.18.0.tar.gz).
- Python 3.13: PSF and bundled notices; https://www.python.org/downloads/source/ . Linux portable builds: https://github.com/astral-sh/python-build-standalone/releases .
- Camoufox: MPL-2.0 and included notices; https://github.com/daijro/camoufox/releases . Application version is recorded in runtime metadata. Corresponding build sources: https://github.com/daijro/camoufox and https://github.com/daijro/camoufox/releases . The optional GeoLite2 database is omitted.
- Chromium / Playwright: bundled Chromium notices and Playwright Apache-2.0; https://github.com/microsoft/playwright .
- Colibri: Apache-2.0; https://github.com/JustVugg/colibri . See the bundled LICENSE and source metadata.
- Tor: BSD-3-Clause (Tor itself) and individual bundled-library licenses; Windows expert bundle 15.0.24 / Tor 0.4.9.13: https://dist.torproject.org/torbrowser/15.0.24/ . Linux distribution license texts remain in runtime/linux/system-libs/usr/share/doc/.
- 7-Zip: LGPL plus unRAR restriction where applicable; https://www.7-zip.org/ .
- FFmpeg Windows 7.1 full build: GPL-3.0, source revision https://github.com/FFmpeg/FFmpeg/commit/b08d7969c5 and build sources https://www.gyan.dev/ffmpeg/builds/ . FFmpeg Linux: see the exact build configuration and bundled license. Source: https://ffmpeg.org/download.html ; static builds: https://github.com/eugeneware/ffmpeg-static and https://github.com/BtbN/FFmpeg-Builds/releases .
- PowerShell (Windows): MIT and bundled third-party notices; https://github.com/PowerShell/PowerShell .
- Git (Windows): GPL-2.0 and bundled notices; https://github.com/git-for-windows/git/releases .
- Serena: MIT; https://github.com/oraios/serena .
- marked: MIT; runtime/ui/lib/ contains its license.

No third-party trademarks imply endorsement. No model weights are redistributed.
