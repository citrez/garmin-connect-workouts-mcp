Fix Garmin sign-in in Claude Desktop’s embedded Node runtime. The extension now runs setup in a background worker instead of trying to launch the Electron host as a Node executable. No separate Node installation is needed. Keep Claude and the extension running while completing sign-in.

Connection guidance now checks progress before claiming the browser has opened. A packaged regression check covers an embedded host whose executable cannot be relaunched.

Download `garmin-workouts-1.4.1.mcpb` for Claude Desktop or `garmin-workouts-plugin-1.4.1.zip` for ChatGPT/Codex. This is an unofficial Garmin integration.
