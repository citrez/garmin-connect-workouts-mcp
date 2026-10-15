import { doctor, setup } from "./doctor.js";
import { GarminError } from "./errors.js";
import { GarminAuth } from "./garmin-auth.js";
import { LoginSession, type LoginStatus } from "./login-session.js";

export const SERVER_INSTRUCTIONS = `When the user asks to connect Garmin, call connect_garmin. It prepares Chrome and starts browser sign-in in a background helper. The user enters passwords and MFA directly on Garmin's website. Call check_garmin_auth immediately for progress or errors before saying the browser has opened, and again for completion; do not repeatedly start login while pending. No sample workout is needed during setup. NETWORK_ERROR, RATE_LIMITED and GARMIN_UNAVAILABLE do not require signing in again. Never automatically retry a workout write after an uncertain network failure; inspect the account first. For training shorthand, WU/CD means warm-up/cool-down, T means threshold/tempo, and R/r means recovery. Use lapButton duration when the user requests variable time; do not invent numerical effort targets. Updates replace the whole workout, so fetch before updating. Naming by date does not request calendar scheduling.`;

export async function connectGarmin(installBrowser = true, auth = new GarminAuth(), session = new LoginSession()): Promise<LoginStatus> {
  if (await auth.getValidAuth()) return { state: "success", message: "Connected to Garmin. You can describe a workout now." };
  return session.start({ installBrowser });
}

/** Runs inside the background helper so a browser download cannot time out an MCP request. */
export async function prepareConnection(installBrowser: boolean) {
  const report = await doctor();
  const blockers = report.checks.filter(check => check.name !== "browser" && !check.ok);
  if (blockers.length) throw new GarminError("SETUP_REQUIRED", blockers.map(check => check.message).join(" "));
  await setup(installBrowser);
}
