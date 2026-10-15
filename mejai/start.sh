#!/usr/bin/env bash
set -euo pipefail
MEJAI_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$MEJAI_DIR"
case "$(uname -m)" in x86_64) arch=x64;; aarch64) arch=arm64;; *) echo 'Unsupported CPU architecture'; exit 1;; esac
node="$MEJAI_DIR/runtime/linux/node/bin/node"
if [ ! -x "$node" ]; then
  echo 'Installing the portable Node.js runtime inside MEJAI...'
  version=v24.18.0
  stage="$MEJAI_DIR/runtime/linux/node-download"
  mkdir -p "$stage" "$MEJAI_DIR/runtime/linux/node"
  name="node-$version-linux-$arch.tar.xz"
  curl --fail --location --retry 2 "https://nodejs.org/dist/$version/$name" -o "$stage/$name"
  curl --fail --location --retry 2 "https://nodejs.org/dist/$version/SHASUMS256.txt" -o "$stage/SHASUMS256.txt"
  (cd "$stage"; grep "  $name$" SHASUMS256.txt | sha256sum --check --status)
  tar -xJf "$stage/$name" -C "$MEJAI_DIR/runtime/linux/node" --strip-components=1
fi
"$node" "$MEJAI_DIR/linux-setup.mjs"
"$node" "$MEJAI_DIR/linux-extras.mjs"
if [ "${1:-}" = '--setup-only' ]; then exit 0; fi
exec "$node" "$MEJAI_DIR/hub.mjs"
