Install Garmin Workouts as a native Claude Desktop extension or a ChatGPT/Codex plugin, then say **Connect my Garmin**.

- New `.mcpb` extension: server/dependencies included, zero required configuration; Claude supplies a compatible Node runtime (>=22.12.0).
- ChatGPT/Codex ZIP includes macOS and Windows registration launchers; the installer preserves existing plugins and backs up marketplace changes.
- One-step connection prepares Chrome in a detached helper and opens Garmin sign-in, including MFA. No sample workout is created during setup.
- MCP setup prompt and server guidance make onboarding discoverable in Claude and other clients.
- Official MCPB schema, host config expansion, protocol/helper, extracted package and launcher checks run across the desktop CI matrix.

Download `garmin-workouts-1.4.0.mcpb` for Claude Desktop, or the plugin ZIP for ChatGPT Work/Codex desktop. See `docs/desktop-installation.md`. Existing npm/stdio installs remain supported. ChatGPT/Codex installation requires Node >=22.12.0; the native Claude extension declares that minimum for its bundled host runtime.

This is an unofficial Garmin integration. Public directory listings require separate submission/review. Web/mobile hosting is not deployed; Garmin Developer Program approval and a selected host are prerequisites.
