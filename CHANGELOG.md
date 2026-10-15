# Changelog

## 1.4.1

- Fix Garmin sign-in in Claude’s embedded Node runtime by using a worker thread instead of relaunching the Electron executable. No separate Node installation is required.
- Report helper launch failures without misleading build instructions, and require a progress check before claiming the browser opened.
- Add a packaged regression check with a non-relaunchable embedded host executable. Keep Claude running during sign-in; standalone Node retains its detached helper.

## 1.4.0

- Native Claude `.mcpb` extension with a declared host runtime minimum, setup prompt and zero required configuration.
- ChatGPT/Codex plugin registration command and macOS/Windows launchers that preserve and back up existing marketplace entries.
- One-step `connect_garmin` onboarding provisions Chrome in the background and starts browser sign-in.
- Shared MCP initialization guidance and a discoverable `garmin_setup` prompt.
- Cross-platform MCPB/launcher tests, desktop installation guide, directory submission brief and explicit hosted rollout prerequisites.

## 1.3.0

- Standalone bundled executables: no source compilation or runtime dependency installation required.
- Portable Codex plugin, setup workflow, workout conventions, and privacy documentation.
- CLI setup, doctor, login, logout, help, and version commands.
- System Chrome discovery and optional managed Chrome installation.
- Local disconnect clears credentials and the dedicated browser profile.
- Structured MCP results and output schemas; distinct auth, network, rate-limit and outage errors.
- Node >=22.12.0, matching the browser adapter's requirements.
- Cross-platform packaged-install and browser smoke tests; versioned release artifacts and npm publishing workflow.
