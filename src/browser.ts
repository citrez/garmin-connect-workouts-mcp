import { existsSync, accessSync, constants } from "node:fs";
import { join, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { Browser, ChromeReleaseChannel, computeSystemExecutablePath, getInstalledBrowsers, install } from "@puppeteer/browsers";
import { PUPPETEER_REVISIONS } from "puppeteer-core/internal/revisions.js";
import { GarminError } from "./errors.js";
import { configDirectory } from "./login-session.js";

export const browserCacheDirectory = () => join(configDirectory(), "browsers");
function usable(path: string): boolean {
  try { accessSync(path, process.platform === "win32" ? constants.F_OK : constants.X_OK); return true; }
  catch { return false; }
}

/** Inspect only; installing never happens as a package lifecycle side effect. */
export async function findBrowser(): Promise<string | null> {
  if (process.env.GARMIN_BROWSER_PATH) {
    const path = process.env.GARMIN_BROWSER_PATH;
    if (!isAbsolute(path) || !usable(path)) throw new GarminError("SETUP_REQUIRED", "GARMIN_BROWSER_PATH must be an absolute path to an executable Chrome/Chromium browser.");
    return path;
  }
  try {
    const path = computeSystemExecutablePath({ browser: Browser.CHROME, channel: ChromeReleaseChannel.STABLE });
    if (usable(path)) return path;
  } catch { /* Chrome is not installed in a standard location. */ }
  if (process.platform === "linux") {
    for (const path of ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"]) {
      if (usable(path)) return path;
    }
  }
  // Reuse browsers from earlier releases without requiring another download.
  for (const cacheDir of [browserCacheDirectory(), process.env.PUPPETEER_CACHE_DIR || join(homedir(), ".cache", "puppeteer")]) {
    if (!existsSync(cacheDir)) continue;
    const cached = await getInstalledBrowsers({ cacheDir });
    const browser = cached.find(item => item.browser === Browser.CHROME && item.buildId === PUPPETEER_REVISIONS.chrome && usable(item.executablePath));
    if (browser) return browser.executablePath;
  }
  return null;
}

export async function ensureBrowser(allowInstall = false): Promise<string> {
  const existing = await findBrowser();
  if (existing) return existing;
  if (!allowInstall) throw new GarminError("SETUP_REQUIRED", "Chrome is missing. Run setup_garmin with installBrowser=true, or run the package CLI with setup --install-browser.");
  try {
    console.error("Downloading Chrome for Testing for Garmin login...");
    const browser = await install({ browser: Browser.CHROME, buildId: PUPPETEER_REVISIONS.chrome, cacheDir: browserCacheDirectory() });
    return browser.executablePath;
  } catch {
    throw new GarminError("SETUP_REQUIRED", "Chrome installation failed. Check your connection, disk space and platform support, or install Chrome and set GARMIN_BROWSER_PATH.");
  }
}
