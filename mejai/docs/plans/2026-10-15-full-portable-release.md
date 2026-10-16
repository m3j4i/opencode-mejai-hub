# Corrected full portable distributions

The user reports that the original Desktop/Agente-Local works but the downloaded 20261014 release does not. The maintenance change fixes plugin precedence and concurrent startup, but users must receive a full independent corrected package.

1. Compare installed original and downloaded kit; inspect health without printing tokens or personal conversations.
2. Preserve the working original. Stage fresh distributions from previously scrubbed runtime archives plus current committed source, including the startup-service fix and no empty root plugin override.
3. Add regression coverage through the actual Hub: concurrent startup, repeated chat snapshots, a complete message round trip against an isolated Ollama protocol fixture, and no engine restart. Verify zero user data before testing.
4. Run relevant tests and lint. Build Windows and Linux full archives and complete source. Extract final archives into different paths and run startup/chat checks from those extracted copies. Use real Ollama only if separately authorized by the user.
5. Publish a new version/tag 1.18.35-mejai.1-hub.20261015.1 with complete runnable packages, source and hashes. Preserve earlier tags and releases. Verify download sizes and hashes; update README links and explain requirements.

Acceptance: a freshly extracted package starts, retains required plugins, sends a message and exposes the response without PID/port changes; no dependency on the original kit's paths, private data or credentials; tools/browser imports still work. Model-dependent limitations are reported honestly.
