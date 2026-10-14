Garmin Workouts can now be installed from a prebuilt package or Codex plugin ZIP.
Users sign into their own Garmin account in a dedicated browser, including MFA.
No source checkout or compilation is needed.

- Standalone CLI/MCP/login helper with bundled runtime dependencies.
- Setup detects Chrome and optionally installs a managed browser; doctor explains missing prerequisites.
- Disconnect closes the Garmin browser and removes local credentials/profile.
- Structured results distinguish missing login, network problems, rate limits, and Garmin outages.
- Codex setup and workout skills cover interval shorthand, dates and lap-button warm-up/cool-down.
- Automated packaged-install and browser checks cover macOS, Windows and Linux.

Requires Node >=22.12.0 and a graphical desktop for sign-in. Download the npm
`.tgz` for command-line installation or the plugin `.zip` for Codex. Verify
checksums with `SHA256SUMS`. See README and `docs/distribution.md` for setup.

GitHub artifacts are available independently of npm registry publication. This
is an unofficial Garmin Connect integration; it is not a public OpenAI directory
listing or a hosted service.
