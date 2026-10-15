# OpenCode (mejai hub)

1.18.35-mejai.1-hub.20261014; native fork based on OpenCode v1.18.35, commit 53d1eabb61e21162157817bf677da0a4ad3332e3. MIT.

This source includes the complete OpenCode fork, native Python tool, upstream-upgrade block, Hub, adapters, plugins, skills, languages and regression fixtures. Runtime dependencies and model weights are separate from source.

## Build the native fork

Install Bun 1.3.14, run bun install at the repository root, then work in packages/opencode. Set OPENCODE_VERSION=1.18.35-mejai.1 and OPENCODE_CHANNEL=mejai. Leave OPENCODE_RELEASE unset (it enables publishing). Run:

```sh
bun script/build.ts --target=opencode-linux-x64-baseline --skip-embed-web-ui
# or Windows x64:
bun script/build.ts --target=opencode-windows-x64 --skip-embed-web-ui
```

The Hub serves its own UI. The binary is emitted under packages/opencode/dist/<target>/bin/. Use bundled release runtimes alongside mejai/ to run the Hub; source alone is not a portable runtime. See mejai/release/build-packages.mjs for the release preparation, exclusions and fresh configuration policy. Run the Hub regression suite with node mejai/testes/executar.mjs; Node/runtime dependencies are needed. Unit packaging checks: node --test mejai/release/package-policy.test.mjs. Native Python checks: bun test test/tool/python.test.ts from packages/opencode.

Upstream automation workflows are retained under docs/upstream-workflows and are inactive by default so a new fork does not publish upstream deployment jobs on its first push. Upstream README is preserved under docs/UPSTREAM-README.md.

## Public distributions

Windows x64 7z; Linux x64 tar.xz (tested Ubuntu 26.04 via WSL); source ZIP. First launch has no chats, accounts, model selection or user files. Ollama and model weights are installed separately. Official upstream updates are disabled; upgrades must preserve this fork and back up existing user data.
