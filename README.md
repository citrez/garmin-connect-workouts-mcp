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

## Quick Start (maintained fork)

This fork is currently installed from source. Its reserved npm identity is
`@citrez/garmin-connect-workouts-mcp`; version 1.2.0 has **not** been published.

```bash
git clone https://github.com/citrez/garmin-connect-workouts-mcp.git
cd garmin-connect-workouts-mcp
pnpm install --frozen-lockfile
pnpm run build
```

Configure any local stdio MCP client with `node` as the command and the
absolute path to `dist/mcp-server.js` as its argument. For example:

```json
{
  "mcpServers": {
    "garmin-workouts": {
      "command": "node",
      "args": ["/absolute/path/garmin-connect-workouts-mcp/dist/mcp-server.js"]
    }
  }
}
```

Restart/reconnect your MCP client after changing its configuration.

## Authentication

1. Run `authenticate_garmin`. It returns promptly and starts a separate local
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
  Puppeteer's bundled Chrome. On macOS this must point to the executable inside
  the `.app`, not the `.app` directory.
- Missing Chrome: run `npx puppeteer browsers install chrome` **from this
  package's directory**, so the browser version matches its Puppeteer dependency.
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
| `authenticate_garmin` | Start/resume login in the background; check progress with `check_garmin_auth`. |

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

## Development

```bash
pnpm install
pnpm test          # vitest: encoders + golden-file tests against real captured payloads
pnpm run build      # compile TypeScript to dist/
pnpm run dev        # run the server directly with tsx
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
