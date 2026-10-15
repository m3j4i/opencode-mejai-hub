# Quality baseline — 2026-10-12

New first-party JavaScript modules in src/ and ui/ must be at most 350 formatted lines and 20 KB. The quality command checks syntax, ESLint and Prettier for the refactored application. ui/editor.js is the generated third-party editor bundle; ui/hub/editor.js is first-party and is checked normally.

The kit-root launchers, existing root services, plugins, legacy unit tests and Python helpers are compatibility code. They remain covered by the regression suite but are not yet fully reformatted or subject to the new module-size ceiling. They must not grow: extract new responsibilities into src/ and replace callers incrementally. Native upstream code keeps upstream tooling and tests, with project rules taking precedence for new local modifications.

Run the bundled Node executable with testes/executar.mjs and testes/qualidade.mjs. The separate integration test testes/integration/test-engine-storage.mjs requires the Hub and engine; it creates and removes only its own fixture conversation and sends noReply=true to store an image without inference. Browser UI tests mock message submission and model output. Passing those checks does not demonstrate real-model autonomy quality.

Avoid broad rewrites of session storage, model configuration or third-party bundles merely to satisfy formatting rules. Record and test any migration explicitly.
