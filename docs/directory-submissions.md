# Desktop directory submission package

The release includes a Claude `.mcpb`, a ChatGPT/Codex plugin ZIP, icon, setup guide,
privacy statement, source/license notices and reproducible smoke tests.
Packaging is not a directory listing, and no submission has been made automatically.

## Suggested listing copy

**Name:** Garmin Workouts

**Short description:** Turn your training session into a structured Garmin workout.

**Description:** Describe a run, cycling session or swim set. Garmin Workouts creates
structured steps, effort targets and repeat blocks in your own Garmin Connect
account and can schedule a workout when requested. To begin, install the desktop
extension and say “Connect my Garmin.” Sign in and complete MFA directly on Garmin's
website in an isolated browser window. The integration runs locally and can download
Chrome for Testing when needed. It is unofficial and not affiliated with Garmin.

**Setup demonstration:** install → Connect my Garmin → complete browser sign-in/MFA
→ check connection → create a user-requested workout → inspect it → disconnect.
Only create a demonstration workout in an account whose owner authorized it.

**Source/support/privacy:** use the links in `manifest.json` and `plugin.json`.

## Claude Desktop

Use the `.mcpb` artifact and the
[desktop extension submission flow](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).
The manifest declares its Node minimum, all tools, setup prompt, zero required
configuration, icon and privacy links. Test on a current Claude Desktop with a
compatible bundled runtime before submission. macOS/Windows are declared targets;
Linux protocol smoke checks do not imply a supported Claude Desktop Linux installer.
Provide a real developer/support contact and any screenshots or recordings required
by the form. The maintainer must review identity details, disclosures and legal terms.

## ChatGPT/Codex

Private/local marketplace distribution is available now. OpenAI's
[desktop-only submission documentation](https://developers.openai.com/plugins/deploy/desktop-only)
currently requires approved-partner eligibility and organization allowlisting for
local MCP submissions. The maintainer must supply/verify the organization identity
and obtain that access before public submission. This package cannot grant it.

The ZIP contains portable manifests, local MCP launch configuration, an onboarding
skill, a workout skill, icon, license notices and setup/privacy documentation.
It requires a local executor. Do not describe it as available to ordinary web/mobile
chats or as an officially endorsed Garmin product.

## Validation evidence

See CI for the exact release commit. CI validates the official MCPB schema, host
variable expansion, declared tools/setup prompt, detached helper, extracted
standalone plugin, native launchers and runtime minimum on Windows/macOS/Linux.
Interactive app installation and real Garmin sign-in/MFA remain manual acceptance
checks; offline CI does not claim to test Garmin credentials or create real workouts.
