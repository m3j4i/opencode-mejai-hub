# Chat startup reliability and maintenance release

Observed: the packaged root opencode.json contains plugin: []. The engine loads it after OPENCODE_CONFIG, removing the generated plugins. findServer marks it legacy; snapshot polling calls start, restarting the engine and canceling Ollama prewarm.

Implementation:
- Supply the required generated plugin list through the engine's final inline configuration layer, preserving other inherited inline settings.
- Coalesce simultaneous startup requests so polling and send cannot launch competing engines.
- Remove the empty plugin override from new sanitized packages; old packages remain supported by the runtime override.
- Expand release integration checks to inspect effective plugins and verify repeated/concurrent starts and chat snapshots keep one engine alive without inference.
- Release an installable maintenance update and source with explicit compatibility and validation evidence; preserve all personal configuration and data.

Acceptance:
- Unit fixtures cover old empty plugin arrays, inherited inline configuration, failed/concurrent/repeated startup.
- Actual bundled Windows engine retains autonomy.mjs under the old package configuration and stays on the same PID/port across polls.
- Existing isolated regression suite and lint/format/syntax checks pass.
- Published release contains only reviewed source/update files and checksums; no user data or credentials.
