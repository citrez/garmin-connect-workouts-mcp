# Distribution and releases

## Shareable artifacts

`npm run release:artifacts` builds a self-contained npm tarball, a standalone Codex
plugin ZIP, a native Claude `.mcpb` extension, and `SHA256SUMS` under `release/`. Compiled CLI, MCP server and detached
login helper bundle their runtime dependencies. The package needs Node >=22.12.0;
it does not need runtime npm dependencies or install scripts. Third-party license
notices are included under `dist/THIRD_PARTY_NOTICES.txt`.

Browser provisioning is explicit at setup time. Every user signs in locally;
credentials, browser profiles, personal workout fixtures and environment files
are excluded from the archives. macOS and Linux use owner-only credential files;
Windows users should retain the private ACLs of their user directory.

## Desktop installers

Use [desktop installation](desktop-installation.md) for the native Claude extension
and the macOS/Windows ChatGPT/Codex registration launchers. Their connection flow
is conversational: **Connect my Garmin**. Public directory submission requirements
and prepared listing copy are in [directory submissions](directory-submissions.md).

## Personal Codex marketplace

Extract the plugin ZIP into a folder under your personal marketplace root (the
user's home directory for `~/.agents/plugins/marketplace.json`). For example,
extract into `~/.codex/plugins/garmin-workouts`. Add this entry to `plugins[]` in
your existing marketplace, preserving its other entries:

```json
{
  "name": "garmin-workouts",
  "source": { "source": "local", "path": "./.codex/plugins/garmin-workouts" },
  "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
  "category": "Productivity"
}
```

If creating a marketplace for the first time, wrap that entry in
`{"name":"personal","interface":{"displayName":"Personal"},"plugins":[...]}`.
Refresh/restart Codex, select that source in the plugin browser, install Garmin
Workouts, and run setup. The plugin directory includes portable `plugin.json`
and `mcp.json`, plus a legacy `.codex-plugin/plugin.json`. Its paths are relative
to the plugin root, not the author's computer. No lifecycle hooks are required.

The published npm package can also be used as a local marketplace source:
`{"source":"npm","package":"@citrez/garmin-connect-workouts-mcp","version":"1.4.0"}`.
Do not use a Git repository as a plugin source unless it includes the built bundle:
source checkouts require a build and Codex does not run lifecycle scripts on install.

## Release procedure

1. Update `package.json`, `server.json` (including its package version),
   `plugin.json`, `.codex-plugin/plugin.json`, `manifest.json`, README links, and release notes.
   Build generates the server version from package metadata and refuses type errors.
2. Open a PR. CI tests macOS, Windows and Linux with Node 22.12.0 and 24. Each job
   tests encoders, browser/login lifecycle, clean package installation, stdio MCP,
   a real headless Chrome page, a standalone plugin ZIP, the official MCPB schema,
   host configuration, setup prompt and native launcher paths. Interactive Garmin
   sign-in/MFA remains a manual acceptance check; CI has no Garmin credentials.
3. After all matrix jobs pass, merge and tag the commit `v<version>`. Pushing the
   tag runs `release.yml`, repeats validation, and publishes GitHub archives.
4. For npm, publish the already-tested tarball with `npm publish release/<file>.tgz
   --access public --ignore-scripts` from an authenticated account with access to
   the `@citrez` scope. Complete npm's required verification in your browser or
   terminal. No credentials belong in the repository or chat.
5. For future automated npm releases, configure a trusted publisher in npm's
   package settings: owner `citrez`, repository `garmin-connect-workouts-mcp`,
   workflow `release.yml`, and allow direct `npm publish`. Set the GitHub repository
   variable `NPM_TRUSTED_PUBLISHING=true`. A package may need its first authenticated
   publication before trusted publishing can be configured. The workflow also
   supports an `NPM_TOKEN` repository secret for an explicitly dispatched release.

The workflow uses Node 24 (npm >=11.5.1) and GitHub OIDC for trusted publishing,
and publishes the exact validated tarball with provenance. Manual workflow
runs default to artifacts only; enable `publish_npm` only after npm setup.

## Public directory

The plugin is ready for local distribution. OpenAI currently limits public
local-MCP submissions to approved partners. Public listing requires the
maintainer's organization to be eligible and allowlisted, followed by portal
submission and review. Shipping an archive is not a public directory listing.

References:
- [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [Desktop-only plugin submissions](https://developers.openai.com/plugins/deploy/desktop-only)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)

## Hosted edition

This release is desktop-only. A hosted edition would require a new per-user
authentication/session architecture and a provider-supported authorization flow
(or another explicitly designed account connection). Do not deploy the shared
local session directory behind a public HTTP endpoint.
