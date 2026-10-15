# OpenCode (mejai hub)

First-party Hub source and regression tests live here alongside the native OpenCode fork. The installed kit is a deployment; this directory is the reviewable source snapshot. It intentionally excludes credentials, live configuration, session databases, model weights and bundled runtimes. The editor bundle retains its third-party license.

Read AGENTS.md, docs/ARCHITECTURE.md and docs/QUALITY-BASELINE.md before changing code. The reconstruction requirements are in recreate/PROMPT-RECRIAR-MEJAI.md. Native modifications are under packages/opencode in the repository root. Official in-place updates are blocked to preserve those changes.

For an existing kit, back up code and data, copy reviewed application files, preserve local configuration and runtimes, and restart only the Hub. Use the kit's Node with testes/executar.mjs and testes/qualidade.mjs. Install the pinned development dependencies from devtools into runtime/devtools when preparing a new kit. This snapshot is not a standalone installer or a published GitHub fork.
