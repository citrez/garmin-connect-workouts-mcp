---
name: garmin-setup
description: Connect a local Garmin account, diagnose setup, or disconnect it using the Garmin Workouts MCP tools.
---

Use `doctor_garmin` to identify missing prerequisites, then `check_garmin_auth` to check the account. Browser sign-in requires a local graphical desktop; web and headless installations cannot run it.

If Chrome is missing, use `setup_garmin` with `installBrowser=true` when the user has requested setup. This downloads Chrome for Testing to local app storage. An invalid `GARMIN_BROWSER_PATH` needs correction; do not silently ignore it.

Call `authenticate_garmin` once. Tell the user to sign in and complete MFA in the dedicated browser, never in chat. Use `check_garmin_auth` for progress; avoid repeatedly launching login while it is pending. If the session is already valid, setup is complete. Do not create a sample workout as part of setup unless asked.

`NETWORK_ERROR`, `RATE_LIMITED`, and `GARMIN_UNAVAILABLE` do not mean the session expired. Preserve the account and report the actionable error. Observe `retryAfterSeconds` when provided; do not loop retries.

Use `disconnect_garmin` when the user requests disconnect/logout or an account change. It removes local credentials and the dedicated browser profile, leaving workouts intact. If login is running, ask the user to close its browser window, then retry after the helper ends. It does not sign the user out of Garmin on other devices.
