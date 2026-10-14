import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { configDirectory } from "./login-session.js";
import { findBrowser, ensureBrowser } from "./browser.js";
import { GarminAuth } from "./garmin-auth.js";
import { GarminError } from "./errors.js";

export interface Diagnostic { name: string; ok: boolean; message: string }
export async function doctor(checkConnection = false) {
  const checks: Diagnostic[] = [];
  const [major, minor] = process.versions.node.split(".").map(Number);
  checks.push({ name: "node", ok: major > 22 || major === 22 && minor >= 12, message: `Node ${process.versions.node}; requires >=22.12.0.` });
  checks.push({ name: "display", ok: process.platform !== "linux" || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY), message: "Garmin login needs a graphical desktop (DISPLAY or WAYLAND_DISPLAY on Linux)." });
  try {
    const browser = await findBrowser();
    checks.push({ name: "browser", ok: Boolean(browser), message: browser ? `Chrome found: ${browser}` : "Chrome is missing. Run setup --install-browser or set GARMIN_BROWSER_PATH." });
  } catch (error) {
    checks.push({ name: "browser", ok: false, message: error instanceof GarminError ? error.message : "Browser inspection failed. Check your browser cache permissions." });
  }
  const directory = configDirectory();
  try {
    let parent = directory;
    while (!existsSync(parent) && dirname(parent) !== parent) parent = dirname(parent);
    accessSync(parent, constants.W_OK);
    checks.push({ name: "storage", ok: true, message: `Session storage: ${directory}` });
  } catch { checks.push({ name: "storage", ok: false, message: "Session storage is not writable. Set GARMIN_CONFIG_DIR to a writable directory." }); }
  if (checkConnection) {
    try {
      const auth = await new GarminAuth(directory).getValidAuth();
      checks.push({ name: "session", ok: Boolean(auth), message: auth ? "Garmin session is valid." : "No valid Garmin session. Run authenticate_garmin or CLI login." });
    } catch (error) {
      checks.push({ name: "session", ok: false, message: error instanceof GarminError ? error.message : "Session check failed." });
    }
  }
  return { ok: checks.every(check => check.ok), checks };
}

export async function setup(installBrowser = false) {
  mkdirSync(configDirectory(), { recursive: true, mode: 0o700 });
  await ensureBrowser(installBrowser);
  return doctor();
}
