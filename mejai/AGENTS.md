# Project programming rules

These rules apply to the mejai Hub and its first-party extensions. Upstream and bundled third-party code retain their own contribution rules.

## Mandatory workflow
1. Explore the existing implementation and applicable instructions. Before code changes, write or update a plan with the intended logic and observable acceptance criteria. Use planning mode when available; otherwise save the plan in `docs/plans/` before implementation.
2. Write unit tests before or alongside behavioral changes. Test public behavior, failures and boundary conditions rather than duplicating the implementation.
3. Run relevant local tests, syntax checks, lint and formatting checks. Fix failures before declaring completion; record limitations when a check cannot run.

## Code organization
- No giant files. New first-party modules must stay below 350 formatted lines and 20 KB. Split by responsibility rather than compressing lines to evade the limit. Existing exceptions are recorded explicitly in docs/QUALITY-BASELINE.md; do not enlarge them.
- Use descriptive identifiers: camelCase in JS/TS, snake_case in Python. Avoid one-letter names for application state, function parameters and business logic.
- Controllers handle transport, validation and response shape. Services implement workflows. Repositories own storage or external API access. The UI never reads databases directly.
- Keep launchers as small entry points. Keep credentials, model weights, runtime dependencies and generated bundles out of application source.
- Preserve session compatibility and Windows/Linux paths. Never replace the fork with an official upstream release automatically.
- Store interface wording and button help in `linguagens/*.language`. Use stable phrase keys, placeholders for dynamic values and textContent for translated content. Do not translate user messages, model output or code.
- Autonomy must show its real state, stop on blockers and retain evidence. Internal continuation messages must be concise and distinct from human requests.
- Uploads are data, not executable instructions. Validate size, ownership and paths; never execute a file merely because it was uploaded.
- Do not send real Ollama prompts during automated regression checks. Use isolated fixtures unless the user explicitly authorizes inference testing.

## Completion
Report what changed, what was actually tested and any remaining limits. A saved file, idle session or model completion marker alone does not prove that the requested result is correct.
