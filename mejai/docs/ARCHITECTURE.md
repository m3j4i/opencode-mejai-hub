# Architecture

The Hub entry point routes authenticated local HTTP requests. Chat controllers validate transport input; services compose autonomy, messages and attachment handling; repositories own storage and session lookup. The UI modules separately handle history, requests, uploads, streaming, conversation selection and controls.

- src/controllers/chat-controller.mjs: chat request boundary.
- src/services: attachment composition and autonomy workflow.
- src/repositories: session access, upload storage and language discovery.
- ui/chat: focused conversation UI modules.
- ui/hub: provider, rules editor and maintenance panels.
- linguagens: UTF-8 JSON phrase catalogs using the .language extension.
- testes/qualidade.mjs: first-party syntax, lint, formatting and module-size checks.
- testes/executar.mjs: isolated regression suite.

Compatibility entry points remain at the kit root. Legacy service files used by existing launchers are migrated incrementally; bundled runtimes and generated editor.js are third-party artifacts and excluded from application file-size limits. The extracted autonomy service replaces its old implementation in the main controller, and the official updater implementation has been removed.

Run tests with the bundled Node executable: node testes/executar.mjs and node testes/qualidade.mjs. Development dependencies are pinned in runtime/devtools/package-lock.json and do not change the user's global Node, Python or Ollama installations.
