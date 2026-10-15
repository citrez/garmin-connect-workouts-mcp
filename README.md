# Garmin Connect Workouts MCP

Maintained fork by [citrez](https://github.com/citrez), based on
[slaat/garmin-connect-workouts-mcp](https://github.com/slaat/garmin-connect-workouts-mcp).
Original authorship and the MIT license are preserved.

An MCP (Model Context Protocol) server that turns natural-language workout
descriptions into structured workouts in Garmin Connect. Describe a session
in plain English and the calling model builds a typed step-by-step workout
that this server encodes into Garmin's workout API format and creates
directly in your account.

## Features

- **Pace, heart-rate, power and cadence targets** - pace ranges, HR zones 1-5,
  explicit bpm ranges, cycling power, and cadence, all encoded against
  Garmin's real `workoutTargetType` table.
- **Real repeat blocks** - `5x1km` becomes a single repeat group, not five
  duplicated steps, so the watch shows an actual rep counter.
- **Swim workouts** - per-step strokes (freestyle, backstroke, breaststroke,
  fly, drill, individual medley, or any stroke) and equipment (fins,
  kickboard, paddles, pull buoy, snorkel), plus a workout-level pool length
  in meters or yards.
- **Full workout lifecycle** - create, list, get, update, delete, and
  schedule workouts onto the Garmin Connect calendar.
- **Structured input, not text parsing** - the server never parses free text
  itself; every duration and target is an explicit, unit-tagged field, so
  there's nothing for a string like "10 min" to be silently misread as.

## Install

Requires **Node >=22.12.0** on macOS, Windows, or Linux. Garmin sign-in needs a
local graphical desktop. This is a desktop integration, not a hosted MCP service.

### Easiest desktop installation

- **Claude Desktop:** download `garmin-workouts-1.4.0.mcpb` from the
  [release](https://github.com/citrez/garmin-connect-workouts-mcp/releases/tag/v1.4.0),
  install it under Settings → Extensions, then say **Connect my Garmin**.
  No terminal, npm install, API key or JSON editing is needed. The extension declares
  a bundled host Node runtime requirement of >=22.12.0.
- **ChatGPT Work / Codex desktop:** extract `garmin-workouts-plugin-1.4.0.zip`,
  open the macOS/Windows launcher in `installers`, restart the app and install
  Garmin Workouts from your personal marketplace. Then say **Connect my Garmin**.
  This route requires Node >=22.12.0 on the computer.

[Step-by-step desktop guide](docs/desktop-installation.md).

### npm

```bash
npm install --global @citrez/garmin-connect-workouts-mcp@1.4.0
```

Register the ChatGPT/Codex plugin without editing JSON:

```bash
garmin-connect-workouts-mcp install-plugin
```

Or use an existing stdio MCP configuration. Every user signs into their own Garmin
account. After tools are available, ask the assistant to **Connect my Garmin**;
the background helper prepares Chrome and opens Garmin sign-in, including MFA.

### Prebuilt GitHub package

Download/install the versioned release; no clone, pnpm, compilation, or browser
postinstall script is required:

```bash
npm install --global https://github.com/citrez/garmin-connect-workouts-mcp/releases/download/v1.4.0/citrez-garmin-connect-workouts-mcp-1.4.0.tgz
garmin-connect-workouts-mcp doctor
garmin-connect-workouts-mcp setup --install-browser
garmin-connect-workouts-mcp login
```

Setup reuses installed Chrome when available. Otherwise `--install-browser`
downloads a matching Chrome for Testing into this application's storage.
Sign in and complete MFA on Garmin's website in the dedicated browser window.

Configure your MCP client:

```json
{
  "mcpServers": {
    "garmin-workouts": {
      "command": "garmin-connect-workouts-mcp",
      "args": []
    }
  }
}
```

For Codex's `config.toml`:

```toml
[mcp_servers.garmin-workouts]
command = "garmin-connect-workouts-mcp"
```

Restart/reconnect your MCP client after changing its configuration. The executable
must be on the desktop client's PATH; if necessary use its full installed path.

### ChatGPT/Codex plugin

The release ZIP includes desktop launchers that register its local marketplace
entry while preserving existing plugins. See [desktop installation](docs/desktop-installation.md).
For custom marketplace layouts, see [manual distribution](docs/distribution.md).

### Run through npx

Version 1.4.0 is available on [npm](https://www.npmjs.com/package/@citrez/garmin-connect-workouts-mcp).
To run without installing the executable globally, configure clients with:

```json
{
  "mcpServers": {
    "garmin-workouts": {
      "command": "npx",
      "args": ["--yes", "@citrez/garmin-connect-workouts-mcp@1.4.0"]
    }
  }
}
```

## Authentication

For normal onboarding, call **`connect_garmin`** once and check progress with
`check_garmin_auth`. It prepares Chrome in the background and opens Garmin sign-in.
Use the individual setup/authentication tools below when diagnosing a specific stage.

1. Run `doctor_garmin`; if Chrome is missing, run `setup_garmin` with
   `installBrowser=true`. Then run `authenticate_garmin`. It returns promptly and starts a separate local
   login helper, which survives MCP request timeouts and client restarts.
2. Sign in and complete MFA directly in the dedicated Chrome window.
3. Run `check_garmin_auth` to see progress, completion, or an actionable error.
   Do not keep calling `authenticate_garmin` while login is pending.

A cross-process lock coordinates login attempts from multiple MCP clients.
Subsequent attempts reconnect to the package's isolated browser instead of
launching another instance against a locked profile. The browser may stay open;
you can close it after login. Closing it during login cancels the attempt, and
`check_garmin_auth` reports that the window closed. A failed/expired session can
be retried in the same browser, with a five-minute login deadline per attempt.
A stopped helper's lock is recovered on the next attempt once its process is gone.

The helper stores session cookies and the CSRF token only after an authenticated
API request succeeds. Credentials are written atomically with owner-only `600`
permissions at `~/.config/garmin-connect-workouts-mcp/auth.json`. Progress files
contain no credentials. No password, cookie, or token is returned through MCP.
The isolated browser profile can also contain sensitive session data; keep this
configuration directory private. Personal browser profiles are never attached.

### Configuration and troubleshooting

- `GARMIN_CONFIG_DIR`: override the configuration/profile directory. All MCP
  clients that should share a login must use the same directory.
- `GARMIN_BROWSER_PATH`: use an installed Chrome/Chromium executable instead of
  the automatically detected/managed Chrome. On macOS this must point to the executable inside
  the `.app`, not the `.app` directory.
- Missing Chrome: run `garmin-connect-workouts-mcp setup --install-browser`, or
  use `setup_garmin` with `installBrowser=true`. Package installation downloads no browser.
- Busy profile: reconnect is attempted automatically. If the existing browser
  cannot be reached, close only the dedicated Garmin login window and retry.
- Interrupted coordination: if a crashed helper left `login-claim.lock`, remove
  that directory from `GARMIN_CONFIG_DIR` (or the default configuration directory)
  after the reported 15-second grace period, then retry.
- Headless/cloud server: this browser adapter requires a local graphical display.
  The Docker image supports tool introspection, not interactive Garmin login.
- Source development: run `pnpm run build` before testing login with `pnpm run dev`;
  the detached helper executes the compiled `dist/login-worker.js`.

### Why Chrome rather than Safari or OAuth?

[MCP authorization](https://modelcontextprotocol.io/specification/latest/basic/authorization)
covers client-to-server authorization for HTTP transports. A local stdio server
manages service credentials separately. That is distinct from authenticating
this server to Garmin.

[Garmin's official Developer Program](https://developer.garmin.com/gc-developer-program/program-faq/)
uses OAuth 2.0. With an approved API integration, the user could authorize in
Safari or another browser and return through an OAuth callback, without capturing
browser cookies. This package currently uses the unofficial Garmin Connect web
API; changing to official OAuth also requires migrating its API calls and obtaining
developer credentials. This release improves the existing web-session adapter.
Safari is not supported by Puppeteer, and copying a personal Safari session into
this server is not part of the login flow.

Disconnect with `disconnect_garmin` or CLI `logout` to close the dedicated browser
and remove local credentials, progress and browser profile. This leaves workouts
and browser downloads intact, and does not revoke Garmin sessions on other devices.
Disconnect refuses while a login is running: close that window and wait for its
helper to finish first. See [privacy](docs/privacy.md).

## CLI

| Command | Purpose |
|---|---|
| `install-plugin [--json]` | Register the ChatGPT/Codex plugin, preserving other marketplace entries. |
| `serve` (default) | Start MCP over stdio. |
| `doctor [--json] [--check-connection]` | Inspect prerequisites; optionally validate the saved session. |
| `setup [--install-browser] [--json]` | Prepare storage; optionally install missing Chrome. |
| `login` | Sign in interactively; complete MFA in the browser. |
| `logout` | Close the dedicated browser and clear local sign-in data. |
| `--help` / `--version` | Show usage or installed version. |

## Tools

| Tool | Description |
|---|---|
| `create_garmin_workout` | Create a structured workout with steps, targets, and repeat blocks. |
| `list_garmin_workouts` | List workouts in the Garmin Connect account. |
| `get_garmin_workout` | Fetch the full structure of one workout. |
| `update_garmin_workout` | Replace an existing workout's contents, keeping its id. |
| `delete_garmin_workout` | Delete a workout. |
| `schedule_garmin_workout` | Put a workout on the Garmin Connect calendar for a date. |
| `check_garmin_auth` | Check whether the stored Garmin session still works. |
| `connect_garmin` | Prepare the browser and connect Garmin in one background setup flow. |
| `authenticate_garmin` | Start/resume login in the background; check progress with `check_garmin_auth`. |
| `doctor_garmin` | Inspect prerequisites; optionally check the session. |
| `setup_garmin` | Prepare storage and optionally download missing Chrome. |
| `disconnect_garmin` | Clear local sign-in data and close the dedicated browser. |

Every tool declares an output schema and returns both human-readable text and
`structuredContent`: `ok`, `state` (`success`, `pending`, `error`), `message`, and
optional `data`, `code`, `status`, and `retryAfterSeconds`. Errors set `isError=true`.
`AUTH_REQUIRED` needs sign-in; `NETWORK_ERROR`, `RATE_LIMITED`, and
`GARMIN_UNAVAILABLE` preserve the session and do not trigger re-authentication.
Writes are never retried automatically. After an ambiguous network failure, inspect
Garmin before repeating a create/schedule operation to avoid duplicates.

## Usage Examples

- "Create a 30 minute easy run in zone 2"
- "10 min warmup zone 3, then 5x1km threshold intervals at 4:00/km with 2 min
  rest between, then 10 min cooldown zone 2"
- "8x400m at 5k pace with 60 second recovery, then check what workouts I
  already have scheduled this week"
- "Update workout 123456 to add a 5 minute cooldown, then schedule it for
  next Monday"
- "Create a 25m pool swim: 200m warmup any stroke, 4x100m freestyle with 30s
  rest using a kickboard, 100m breaststroke cooldown"

## How targets work

A stated pace is treated as the **fast edge** of a range: Garmin stores pace
as a range, not a single point, so `4:00/km` on its own becomes a
`4:00-4:10/km` range, widened by 10 seconds. Give both `fast` and `slow`
explicitly for a narrower or different range.

The MCP server also publishes a **`garmin_setup`** prompt and initialization
instructions so Claude and other clients can discover the onboarding flow.

## Development

```bash
pnpm install
pnpm test          # vitest: encoders + golden-file tests against real captured payloads
pnpm run build      # type-check and bundle standalone executables
pnpm run dev        # run the server directly with tsx
npm run test:package -- --browser-smoke  # clean npm install + real Chrome + MCP
npm run release:artifacts              # npm tarball, plugin ZIP, SHA256 sums
node scripts/plugin-smoke.mjs          # ZIP works without node_modules
npm run test:desktop                  # MCPB, setup prompt and native launchers
```

Tests cover login coordination, abandoned locks, error categories, credential-file
permissions, and the workout encoders (targets, durations, repeat nesting)
against fixtures captured from Garmin's own web client, so payload shape
regressions get caught before they reach a real account.

## Disclaimer

This is an unofficial, third-party project. It is not affiliated with,
endorsed by, or sponsored by Garmin Ltd. or any of its affiliates, and it
talks to Garmin Connect's web API by reverse-engineering the same requests
the official web client makes. It may stop working if Garmin changes that
API. Use at your own risk, and at your own responsibility for the workouts
and data you send to your account.

## Acknowledgements

Thanks to [garmin-workouts-mcp](https://github.com/charlesfrisbee/garmin-workouts-mcp)
by Charles Frisbee for the original idea of driving Garmin Connect workouts
through MCP.

## License

MIT
