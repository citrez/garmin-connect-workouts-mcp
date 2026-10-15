# Privacy

This unofficial integration runs locally. It sends workout requests directly to Garmin Connect and does not operate a hosted service or collect analytics.

Passwords and MFA codes are entered on Garmin's website in an isolated Chrome profile. The integration stores session cookies and a CSRF token on your computer; it does not store your password separately. The browser profile may retain Garmin's sign-in state. Treat both as credentials.

Session data lives under `~/.config/garmin-connect-workouts-mcp` by default, or `GARMIN_CONFIG_DIR` if configured. Credential files are written atomically with owner-only Unix permissions. On Windows, protection follows your user-folder ACLs; use a private directory. Browser downloads live in the same app directory and are retained after logout.

Your MCP client receives the workout data you request and may handle it under its own privacy policy. Tool results never deliberately include cookies, tokens, or raw Garmin error bodies. Diagnostic output includes local paths.

Disconnect using the `disconnect_garmin` tool or CLI `logout` to close the dedicated browser and remove local credentials, login state and its browser profile. This does not revoke other Garmin sessions or delete workouts. Remove the app directory to uninstall retained browser downloads after disconnecting.

Installing a missing browser downloads Chrome for Testing from Google's distribution service. Package installation itself performs no browser download.

The ChatGPT/Codex installer copies only the packaged plugin files and registers a
local marketplace entry. It preserves existing entries and backs up changed
marketplace JSON. It does not request or copy Garmin credentials during installation.
The Claude extension likewise has no required password, token or API-key setting.
