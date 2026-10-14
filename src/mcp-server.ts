#!/usr/bin/env node

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { doctor, setup } from "./doctor.js";
import { GarminError } from "./errors.js";
import { VERSION } from "./version.js";
import { LoginSession } from "./login-session.js";
import { GarminAuth } from "./garmin-auth.js";
import { GarminClient } from "./garmin/client.js";
import { sportSchema, stepSchema, workoutDataSchema, type WorkoutData } from "./workout/types.js";

const server = new McpServer(
  { name: "garmin-connect-workouts", version: VERSION },
  { capabilities: { tools: {} } }
);

const garminAuth = new GarminAuth();
const loginSession = new LoginSession();

const NEEDS_AUTH =
  "❌ Not authenticated with Garmin Connect. Run the 'authenticate_garmin' tool - it opens a browser for a normal Garmin login.";

const workoutIdField = z
  .number()
  .describe(
    "The numeric Garmin workout id, as returned by create_garmin_workout or listed by list_garmin_workouts."
  );
const stepsField = z
  .array(stepSchema)
  .min(1)
  .describe(
    "The ordered list of steps and repeat blocks that make up the workout, in the order they should be performed."
  );
const poolLengthField = workoutDataSchema.shape.poolLength;
const poolLengthUnitField = workoutDataSchema.shape.poolLengthUnit;
const nameField = z.string().describe("Workout name, shown in Garmin Connect and on the device.");

const resultSchema = {
  ok: z.boolean(),
  state: z.enum(["success", "pending", "error"]),
  message: z.string(),
  code: z.string().optional(),
  status: z.number().optional(),
  retryAfterSeconds: z.number().optional(),
  data: z.record(z.unknown()).optional(),
};
const text = (message: string, data?: Record<string, unknown>, state: "success" | "pending" | "error" = "success", code?: string, metadata: Record<string, unknown> = {}) => ({
  content: [{ type: "text" as const, text: message }],
  structuredContent: { ok: state !== "error", state, message, ...(data ? { data } : {}), ...(code ? { code } : {}), ...metadata },
  ...(state === "error" ? { isError: true } : {}),
});
const needsAuth = () => text(NEEDS_AUTH, undefined, "error", "AUTH_REQUIRED");

async function withClient<T>(fn: (client: GarminClient) => Promise<T>) {
  const auth = await garminAuth.getValidAuth();
  if (!auth) return null;
  return fn(new GarminClient(auth));
}

function safe<Args extends any[]>(
  handler: (...args: Args) => Promise<ReturnType<typeof text>>
): (...args: Args) => Promise<ReturnType<typeof text>> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof GarminError) return text(error.message, undefined, "error", error.code, {
        ...(error.status !== undefined ? { status: error.status } : {}),
        ...(error.retryAfterSeconds !== undefined ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
      });
      return text("The operation failed. Run doctor_garmin to check setup, then retry. A write may have completed; check Garmin before repeating it.", undefined, "error", "INTERNAL_ERROR");
    }
  };
}

server.registerTool(
  "create_garmin_workout",
  {
    description:
      "Create a new structured workout in Garmin Connect from typed steps: durations, pace/HR/power/cadence targets, repeat blocks for intervals, and swim-specific stroke/equipment/pool-length fields. Use to add a workout; to change one that exists, use update_garmin_workout instead. Returns the new workoutId and a Connect link. Returns a re-auth message, not an exception, if no valid session exists. Example: [{kind:'step', intensity:'warmup', duration:{type:'time', value:10, unit:'min'}}, {kind:'repeat', iterations:5, steps:[...]}].",
    inputSchema: {
      name: nameField,
      sport: sportSchema
        .default("running")
        .describe(
          "Sport for this workout: running, cycling, or swimming. Governs which target types apply and whether stroke/equipment/poolLength are used. Defaults to running."
        ),
      steps: stepsField,
      poolLength: poolLengthField,
      poolLengthUnit: poolLengthUnitField,
    },
    outputSchema: resultSchema,
    annotations: { title: "Create Garmin workout" },
  },
  safe(async (args) => {
    const workout = args as WorkoutData;
    const result = await withClient((c) => c.createWorkout(workout));
    if (!result) return needsAuth();
    return text(
      `✅ Created **${result.workoutName}** (ID: ${result.workoutId})\n\n🔗 ${GarminClient.workoutUrl(result.workoutId)}\n\nSync your device to pick it up.`, { workoutId: result.workoutId, workoutName: result.workoutName, url: GarminClient.workoutUrl(result.workoutId) }
    );
  })
);

server.registerTool(
  "list_garmin_workouts",
  {
    description:
      "List workouts stored in the Garmin Connect account, most recent first, with each workout's name, sport, and workoutId. Use this to find a workoutId to pass to get_garmin_workout, update_garmin_workout, delete_garmin_workout, or schedule_garmin_workout. Read-only. If no valid session exists, returns a message asking you to run authenticate_garmin rather than throwing.",
    inputSchema: {
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .default(20)
        .describe("Maximum number of workouts to return, most recent first. Defaults to 20, capped at 100."),
    },
    outputSchema: resultSchema,
    annotations: { title: "List Garmin workouts", readOnlyHint: true, idempotentHint: true },
  },
  safe(async (args) => {
    const list = await withClient((c) => c.listWorkouts(args.limit ?? 20));
    if (!list) return needsAuth();
    if (!list.length) return text("No workouts found.", { workouts: [] });
    return text(
      list
        .map(
          (w) =>
            `- **${w.workoutName}** (${w.sportType?.sportTypeKey ?? "?"}) — ID ${w.workoutId}`
        )
        .join("\n"), { workouts: list }
    );
  })
);

server.registerTool(
  "get_garmin_workout",
  {
    description:
      "Fetch the complete stored structure (all steps, targets, repeat blocks) of one workout by its workoutId, as raw JSON. Use this to inspect a workout, or to get its full contents before calling update_garmin_workout, which replaces the entire workout rather than patching it. Read-only. If no valid session exists, returns a message asking you to run authenticate_garmin rather than throwing.",
    inputSchema: { workoutId: workoutIdField },
    outputSchema: resultSchema,
    annotations: { title: "Get Garmin workout", readOnlyHint: true, idempotentHint: true },
  },
  safe(async (args) => {
    const workout = await withClient((c) => c.getWorkout(args.workoutId));
    if (!workout) return needsAuth();
    return text("```json\n" + JSON.stringify(workout, null, 2) + "\n```", { workout });
  })
);

server.registerTool(
  "update_garmin_workout",
  {
    description:
      "Replace the entire contents (name, sport, steps, pool settings) of an existing workout, identified by workoutId, keeping its id. This is a full overwrite, not a partial patch - fields you omit are dropped. Call get_garmin_workout first to see the current contents before changing them. If no valid session exists, returns a message asking you to run authenticate_garmin rather than throwing.",
    inputSchema: {
      workoutId: workoutIdField,
      name: nameField,
      sport: sportSchema.describe(
        "Sport for this workout: running, cycling, or swimming. Governs which target types apply and whether stroke/equipment/poolLength are used."
      ),
      steps: stepsField,
      poolLength: poolLengthField,
      poolLengthUnit: poolLengthUnitField,
    },
    outputSchema: resultSchema,
    annotations: { title: "Update Garmin workout", idempotentHint: true, destructiveHint: true },
  },
  safe(async (args) => {
    const { workoutId, ...workout } = args;
    const done = await withClient(async (c) => {
      await c.updateWorkout(workoutId, workout as WorkoutData);
      return true;
    });
    if (!done) return needsAuth();
    return text(`✅ Updated workout ${workoutId}\n\n🔗 ${GarminClient.workoutUrl(workoutId)}`, { workoutId, url: GarminClient.workoutUrl(workoutId) });
  })
);

server.registerTool(
  "delete_garmin_workout",
  {
    description:
      "Permanently delete a workout from Garmin Connect by workoutId. This is irreversible - there is no undo or trash. Use list_garmin_workouts or get_garmin_workout first to confirm you have the right workoutId. If no valid session exists, returns a message asking you to run authenticate_garmin rather than throwing.",
    inputSchema: { workoutId: workoutIdField },
    outputSchema: resultSchema,
    annotations: { title: "Delete Garmin workout", destructiveHint: true },
  },
  safe(async (args) => {
    const done = await withClient(async (c) => {
      await c.deleteWorkout(args.workoutId);
      return true;
    });
    if (!done) return needsAuth();
    return text(`🗑️ Deleted workout ${args.workoutId}`, { workoutId: args.workoutId });
  })
);

server.registerTool(
  "schedule_garmin_workout",
  {
    description:
      "Put an existing workout on the Garmin Connect calendar for a specific date, so it appears as a planned session and can sync to a device. Requires a workoutId already created via create_garmin_workout or found via list_garmin_workouts - this tool does not create workouts. If no valid session exists, returns a message asking you to run authenticate_garmin rather than throwing.",
    inputSchema: {
      workoutId: workoutIdField,
      date: z.string().describe("Calendar date to schedule the workout on, in YYYY-MM-DD format, e.g. '2026-09-15'."),
    },
    outputSchema: resultSchema,
    annotations: { title: "Schedule Garmin workout" },
  },
  safe(async (args) => {
    const done = await withClient(async (c) => {
      await c.scheduleWorkout(args.workoutId, args.date);
      return true;
    });
    if (!done) return needsAuth();
    return text(`📅 Scheduled workout ${args.workoutId} for ${args.date}`, { workoutId: args.workoutId, date: args.date });
  })
);

server.registerTool(
  "check_garmin_auth",
  {
    description:
      "Probe whether the stored Garmin Connect session is still valid, using a cheap authenticated request rather than a local expiry check (Garmin's session cookie does not carry a reliable expiry). Use this first when unsure whether the other tools will work. Reports pending login, specific login failures, or an expired/missing session. Never returns cookies or tokens.",
    outputSchema: resultSchema,
    annotations: { title: "Check Garmin auth", readOnlyHint: true, idempotentHint: true },
  },
  safe(async () => {
    const auth = await garminAuth.getValidAuth();
    if (auth) return text(`✅ Garmin session is valid (captured ${new Date(auth.capturedAt).toLocaleString()}).`);
    const status = loginSession.read();
    return status && status.state !== "success" ? text(status.message, undefined, status.state === "pending" ? "pending" : "error", status.state === "error" ? status.code || "LOGIN_FAILED" : undefined) : needsAuth();
  })
);

server.registerTool(
  "authenticate_garmin",
  {
    description:
      "Start or resume Garmin sign-in in a dedicated Chrome window. Returns immediately while a separate local helper completes login. The same browser is reused across MCP restarts. Sign in and complete MFA in the browser, then call check_garmin_auth for completion or actionable errors. Never enter credentials in chat. Requires a local graphical display.",
    outputSchema: resultSchema,
    annotations: { title: "Authenticate with Garmin" },
  },
  safe(async () => {
    const auth = await garminAuth.getValidAuth();
    if (auth) return text("✅ Already authenticated with Garmin Connect.");
    const status = loginSession.start();
    return text(status.message, undefined, status.state === "pending" ? "pending" : status.state === "error" ? "error" : "success", status.state === "error" ? status.code || "LOGIN_FAILED" : undefined);
  })
);

server.registerTool("doctor_garmin", {
  description: "Inspect Node, Chrome, desktop display, and writable session storage without changing them. Optionally verify the saved Garmin session. Never returns credentials.",
  inputSchema: { checkConnection: z.boolean().default(false) }, outputSchema: resultSchema,
  annotations: { title: "Diagnose Garmin setup", readOnlyHint: true, idempotentHint: true },
}, safe(async ({ checkConnection }) => {
  const report = await doctor(checkConnection);
  return text(report.checks.map(check => `${check.ok ? "OK" : "FIX"} ${check.name}: ${check.message}`).join("\n"), { checks: report.checks }, report.ok ? "success" : "error", report.ok ? undefined : "SETUP_REQUIRED");
}));

server.registerTool("setup_garmin", {
  description: "Prepare local Garmin storage and detect Chrome. Set installBrowser=true to download Chrome for Testing if no compatible browser is found. Does not sign in or change workouts.",
  inputSchema: { installBrowser: z.boolean().default(false) }, outputSchema: resultSchema,
  annotations: { title: "Set up Garmin", destructiveHint: false, idempotentHint: true },
}, safe(async ({ installBrowser }) => {
  const report = await setup(installBrowser);
  return text(report.checks.map(check => `${check.ok ? "OK" : "FIX"} ${check.name}: ${check.message}`).join("\n"), { checks: report.checks }, report.ok ? "success" : "error", report.ok ? undefined : "SETUP_REQUIRED");
}));

server.registerTool("disconnect_garmin", {
  description: "Disconnect this local Garmin account: close only the dedicated Garmin browser and remove saved credentials, login progress and browser profile. Leaves workouts and the downloaded browser intact. Refuses while login is running. Does not revoke sessions on Garmin's other devices.",
  outputSchema: resultSchema,
  annotations: { title: "Disconnect Garmin", destructiveHint: true, idempotentHint: true },
}, safe(async () => {
  await garminAuth.logout();
  return text("Disconnected. Local Garmin credentials and browser profile removed. Your workouts are unchanged.");
}));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Garmin Connect Workouts MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
