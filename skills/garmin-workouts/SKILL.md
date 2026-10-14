---
name: garmin-workouts
description: Create, inspect, update, or schedule structured Garmin running, cycling, and swimming workouts from training descriptions.
---

Translate the user's session into typed steps and true repeat blocks. The MCP accepts structured input; it does not parse training text itself.

- WU/CD means warm-up/cool-down. When the user wants variable duration, use `duration: {type: "lapButton"}` and retain any suggested duration in notes. Otherwise preserve explicit times or distances.
- T usually denotes threshold/tempo effort; label the step accordingly. Do not invent numerical pace, heart-rate, or power targets. Ask only when an unresolved ambiguity materially changes the workout.
- `4'` is four minutes; `45s` is 45 seconds. Parenthesized recovery belongs after its effort. A separate `+ 2min R` is additional recovery after the repeat block; do not silently replace its final recovery.
- Preserve recovery after the last repetition when explicitly included. If only between-rep recovery is requested, repeat the effort/recovery pair one fewer time and append the final effort.
- Resolve relative dates using the user's current date and timezone. Use their chosen date format, or DD/MM/YYYY when naming a workout by date without a stated format. Naming by date does not by itself request calendar scheduling.
- Supply both bounds for exact pace ranges. A lone `fast` pace is widened by the server. Pace units are explicit min/km or min/mi; do not infer from locale.

Create only after the requested structure is clear, then return the workout link. For updates, fetch the complete workout first: update replaces all contents and omitted fields are dropped. Before deletion, identify the intended workout from list/get. Schedule only when asked.

Every result includes `structuredContent` with `ok`, `state`, `message`, and optional `data` or error `code`. Treat `pending` as login in progress. An `isError` result is not a successful write. If a write has a network error, check the Garmin account before retrying to avoid duplicates. Do not automatically repeat writes.
