# Install Garmin Workouts

## Claude Desktop: no terminal setup

1. Download **garmin-workouts-1.4.0.mcpb** from the
   [1.4.0 release](https://github.com/citrez/garmin-connect-workouts-mcp/releases/tag/v1.4.0).
2. Open Claude Desktop → Settings → Extensions → Advanced settings → Install Extension,
   select the `.mcpb` file, and review/accept its installation prompt. On supported
   versions, opening the downloaded `.mcpb` file directly also opens the installer.
3. In a new conversation, say **Connect my Garmin**. Allow Garmin Workouts tools
   when Claude requests permission.
4. Complete sign-in and MFA in the dedicated Garmin browser window. Wait for Claude
   to confirm the connection, then describe a workout.

The extension includes the server and dependencies. Claude supplies Node; a host
runtime of **22.12.0 or newer** is declared in the manifest. If the app reports an
incompatible runtime, update Claude Desktop. No API key or JSON configuration is
needed. The host must support local desktop extensions and your organization must
allow custom extensions. The manifest targets macOS and Windows.

Chrome is reused if installed. Otherwise the connection helper downloads official
Chrome for Testing into this app's local storage. The first connection may take
longer while it downloads. Passwords and MFA codes are entered on Garmin's website,
not in the conversation. Nothing is created in Garmin just by connecting.

## ChatGPT Work / Codex desktop

1. Download and extract **garmin-workouts-plugin-1.4.0.zip** from the same release.
2. Open the `installers` folder in the extracted package:
   - macOS: open `Install-Garmin-Workouts.command`.
   - Windows: open `Install-Garmin-Workouts.cmd`.
3. Restart the desktop app. In Plugins, select your personal marketplace (the
   installer's confirmation names it), find **Garmin Workouts**, and install it.
4. Run plugin setup or say **Connect my Garmin** in a conversation running locally.
5. Complete Garmin sign-in and MFA in the dedicated browser.

This route needs Node **22.12.0 or newer** on the computer. If missing, the launcher
explains how to install it from [nodejs.org](https://nodejs.org/). macOS security
policy may require you to review an unsigned downloaded launcher. Do not disable
system protections; the npm command below is an alternative.

If you already use npm, run just:

```bash
npx --yes @citrez/garmin-connect-workouts-mcp@1.4.0 install-plugin
```

The installer copies the plugin to an immutable version folder under
`~/.codex/plugins/garmin-workouts/1.4.0` and adds its entry to
`~/.agents/plugins/marketplace.json`. Existing plugins, marketplace names and
explicit install policies are preserved. Changes to an existing marketplace are
backed up beside the original file. It refuses malformed JSON, conflicting plugin
names and unowned destination folders. Installing the package registers its local
source; you still choose Install in the app.

Users with custom marketplace layouts can follow [manual distribution instructions](distribution.md).

## Existing CLI / Claude Desktop configurations

The npm executable and existing stdio configurations remain supported:

```bash
npm install --global @citrez/garmin-connect-workouts-mcp@1.4.0
```

Then call `connect_garmin` through your client. Alternatively run
`garmin-connect-workouts-mcp login` from a terminal; login now provisions a missing
browser as part of setup.

Avoid registering both the manual stdio connection and native extension in the
same client, which would show duplicate tool sets. Remove the old manual entry
when moving to the extension; keep other servers intact.

## Diagnose or disconnect

Ask **Check my Garmin connection**. If setup fails, ask **Diagnose Garmin setup**.
A background download is reported as pending; there is no need to launch it again.
Network problems, Garmin outages and rate limits keep the saved account session.

Ask **Disconnect Garmin** to close the isolated browser and remove its local sign-in
data. This does not remove workouts or sign out other Garmin devices.

To remove a ChatGPT/Codex registration manually, remove only its `garmin-workouts`
entry from your personal marketplace and its owned version directory. Backups can
restore the previous marketplace file; review their contents before replacing a
file with newer unrelated edits.

## Web and mobile

These packages run on the desktop computer. They do not add a remote MCP endpoint
to ChatGPT web/mobile, claude.ai, or Claude mobile. The hosted version is not
implemented or deployed; see [hosted rollout prerequisites](hosted-rollout.md).
