---
name: garmin-setup
description: Connect a local Garmin account, diagnose setup, or disconnect it using the Garmin Workouts MCP tools.
---

When the user asks to connect, call `connect_garmin` once. It checks an existing session and starts a detached helper that prepares Chrome and opens sign-in. It defaults to downloading official Chrome for Testing if no browser is available; the user's request to set up Garmin covers this prerequisite. Set `installBrowser=false` if they do not want a download.

Tell the user to sign in and complete MFA in the dedicated browser, never in chat. Use `check_garmin_auth` for progress; the helper may still be downloading Chrome. Do not repeatedly start login while pending. Once the session is valid, setup is complete; do not create a sample workout unless asked.

Use `doctor_garmin` to diagnose setup failures. An invalid `GARMIN_BROWSER_PATH` must be corrected rather than silently ignored. Sign-in needs a graphical desktop. Use `setup_garmin` and `authenticate_garmin` separately only when diagnosing a specific stage.

`NETWORK_ERROR`, `RATE_LIMITED`, and `GARMIN_UNAVAILABLE` do not mean the session expired. Preserve the account and report the actionable error. Observe `retryAfterSeconds` when provided; do not loop retries.

Use `disconnect_garmin` when the user requests disconnect/logout or an account change. It removes local credentials and the dedicated browser profile, leaving workouts intact. If login is running, ask the user to close its browser window, then retry after the helper ends. It does not sign the user out of Garmin on other devices.
