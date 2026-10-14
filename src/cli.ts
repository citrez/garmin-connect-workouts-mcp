#!/usr/bin/env node
import { doctor, setup } from "./doctor.js";
import { GarminAuth } from "./garmin-auth.js";
import { LoginSession } from "./login-session.js";
import { GarminError } from "./errors.js";
import { VERSION } from "./version.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "serve";
  const allowed: Record<string, string[]> = { serve: [], doctor: ["--json", "--check-connection"], setup: ["--install-browser", "--json"], login: [], logout: [], "--help": [], "--version": [] };
  if (!(command in allowed) || args.slice(1).some(arg => !allowed[command].includes(arg))) throw new GarminError("SETUP_REQUIRED", "Unknown command or option. Run --help for usage.");
  if (command === "serve") { await import("./mcp-server.js"); return; }
  if (command === "--version") { console.log(VERSION); return; }
  if (command === "--help") {
    console.log("Garmin Connect Workouts MCP\n\nserve (default)              Start the stdio MCP server\ndoctor [--check-connection] [--json]\n                            Inspect Node, browser, display and storage\nsetup [--install-browser] [--json]\n                            Prepare storage; optionally download Chrome\nlogin                       Open Garmin sign-in in a dedicated browser\nlogout                      Close that browser and clear local sign-in data\n--version                   Show package version\n\nRequires Node >=22.12.0 and a local graphical desktop for login.");
    return;
  }
  if (command === "doctor" || command === "setup") {
    const report = command === "doctor" ? await doctor(args.includes("--check-connection")) : await setup(args.includes("--install-browser"));
    console.log(args.includes("--json") ? JSON.stringify(report) : report.checks.map(check => `${check.ok ? "OK" : "FIX"} ${check.name}: ${check.message}`).join("\n"));
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (command === "login") {
    const auth = new GarminAuth();
    if (await auth.getValidAuth()) { console.log("Already connected to Garmin."); return; }
    await setup();
    const session = new LoginSession();
    if (!session.claim()) throw new GarminError("LOGIN_BUSY", "Garmin login is already running. Complete sign-in in its browser window.");
    try {
      await auth.authenticate();
      session.write({ state: "success", message: "Garmin login completed." });
      console.log("Connected to Garmin.");
    } catch (error) {
      session.write({ state: "error", message: "Login did not complete. Run login again to retry." });
      throw error;
    } finally { session.release(); }
    return;
  }
  await new GarminAuth().logout();
  console.log("Disconnected. Local Garmin credentials and browser profile removed. Workouts are unchanged.");
}

main().catch(error => {
  const message = error instanceof GarminError ? error.message : "Operation failed. Run doctor to check your setup.";
  if (process.argv.includes("--json")) console.log(JSON.stringify({ ok: false, code: error instanceof GarminError ? error.code : "INTERNAL_ERROR", message }));
  else console.error(message);
  process.exitCode = 1;
});
