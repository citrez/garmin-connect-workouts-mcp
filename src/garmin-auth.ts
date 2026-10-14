import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, chmodSync, renameSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import puppeteer from "puppeteer-core";
import { ensureBrowser } from "./browser.js";
import { GarminError, garminFetch, responseError } from "./errors.js";
import { LoginSession } from "./login-session.js";

/**
 * Garmin Connect's web client authenticates with session cookies plus a
 * `Connect-Csrf-Token` header against a `/gc-api/` proxy. It does NOT send an
 * `Authorization: Bearer` header, and the older `connectapi.garmin.com` surface
 * this project used to target now 404s.
 *
 * The `JWT_WEB` cookie looks like a credential but is not one: a captured
 * request succeeded four minutes after that JWT's `exp`. So there is nothing to
 * parse for expiry - validity has to be probed.
 */
export interface AuthData {
  cookies: string;
  csrfToken: string;
  capturedAt: number;
}

export const GC_API_BASE = "https://connect.garmin.com/gc-api";

/**
 * The minimal header set Garmin accepts, established by dropping headers one at
 * a time against a live session: without any one of these the API answers 403.
 * Everything the previous implementation sent - `di-backend`, `nk`,
 * `x-app-ver`, `x-lang` - is obsolete and ignored.
 */
export function garminHeaders(auth: AuthData, extra: Record<string, string> = {}) {
  return {
    accept: "application/json, text/plain, */*",
    cookie: auth.cookies,
    "Connect-Csrf-Token": auth.csrfToken,
    "Sec-Fetch-Site": "same-origin",
    ...extra,
  };
}

export class GarminAuth {
  private configDir: string;
  private authFile: string;
  private browserProfileDir: string;

  constructor(configDir = process.env.GARMIN_CONFIG_DIR || join(homedir(), ".config", "garmin-connect-workouts-mcp")) {
    this.configDir = configDir;
    this.authFile = join(this.configDir, "auth.json");
    this.browserProfileDir = join(this.configDir, "browser-profile");
  }

  /**
   * Return stored credentials if they still work.
   *
   * Unlike the previous JWT-expiry check this costs a network round trip, but
   * there is no longer any expiry encoded in what we hold. Probing is also
   * strictly more honest: it catches server-side session revocation, which a
   * local timestamp never could.
   */
  async getValidAuth(): Promise<AuthData | null> {
    const stored = this.loadStoredAuth();
    if (!stored) {
      return null;
    }
    return (await this.probe(stored)) ? stored : null;
  }

  /** Cheap authenticated GET used to test whether a session is still live. */
  private async probe(auth: AuthData): Promise<boolean> {
    const res = await garminFetch(
      `${GC_API_BASE}/workout-service/workouts?start=1&limit=1`,
      { headers: garminHeaders(auth) }
    );
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403) return false;
    throw responseError(res);
  }

  /**
   * Drive a real browser through Garmin's normal web login and capture the
   * resulting session.
   *
   * This deliberately avoids the mobile SSO OAuth flow that `garth` and the
   * wider ecosystem depend on: Garmin broke that on 2026-03-17 and it no longer
   * grants new logins. Driving the web UI also gives us a genuine TLS
   * fingerprint, which Garmin uses to block third-party clients.
   */
  async authenticate(): Promise<AuthData | null> {
    mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    console.error("🚀 Starting Garmin authentication...");

    // A persistent, isolated profile (never the user's personal browser) lets
    // Garmin's own "remember me"/device-trust cookies survive between runs,
    // so a re-login usually doesn't require full credential entry again.
    if (!existsSync(this.browserProfileDir)) {
      mkdirSync(this.browserProfileDir, { recursive: true, mode: 0o700 });
    }

    // Reconnect only to this package's isolated profile, never a personal browser.
    const reconnect = async () => {
      try {
        const [port, wsPath] = readFileSync(join(this.browserProfileDir, "DevToolsActivePort"), "utf8").trim().split("\n");
        if (!/^\d+$/.test(port) || !/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(wsPath)) return null;
        return await puppeteer.connect({ browserWSEndpoint: `ws://127.0.0.1:${port}${wsPath}`, protocolTimeout: 10000 });
      } catch { return null; }
    };
    let browser = await reconnect();
    if (!browser) {
      try {
        browser = await puppeteer.launch({
          headless: false,
          userDataDir: this.browserProfileDir,
          executablePath: await ensureBrowser(),
          args: ["--disable-blink-features=AutomationControlled"],
        });
      } catch (error) {
        // Another server may have launched the shared browser concurrently.
        browser = await reconnect();
        if (!browser) throw error instanceof GarminError ? error : new GarminError("SETUP_REQUIRED", browserLaunchMessage(error));
      }
    }

    let authData: AuthData | null = null;

    try {
      const page = await browser.newPage();

      await page.setViewport({ width: 1366, height: 768 });

      let csrfToken = "";

      // The SPA sends Connect-Csrf-Token on every /gc-api/ call, reads included,
      // so simply loading the workouts list surfaces one. Keep the newest: the
      // token is stable for a session, but a re-login mid-flow rotates it.
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.origin !== "https://connect.garmin.com" || !url.pathname.startsWith("/gc-api/")) return;
        const token = request.headers()["connect-csrf-token"];
        if (token) {
          if (!csrfToken) {
            console.error("🎯 Captured CSRF token!");
          }
          csrfToken = token;
        }
      });

      console.error("🔐 Opening Garmin Connect login...");
      console.error("👉 Please login manually in the browser");

      await page.goto("https://connect.garmin.com/app/workouts", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      console.error("⏳ Waiting for login completion...");

      // Poll Node-side state rather than waiting on a DOM selector: Garmin
      // reworks the workouts page markup regularly, and a stale selector turns
      // a failed login into a silent five-minute hang.
      const deadline = Date.now() + 300000;
      let candidate: AuthData | null = null;
      while (Date.now() < deadline) {
        if (!browser.connected || page.isClosed()) throw new Error("Login window closed. Run authenticate_garmin to reopen it.");
        if (csrfToken && new URL(page.url()).origin === "https://connect.garmin.com") {
          const pageCookies = (await browser.cookies()).filter(cookie => {
            const domain = cookie.domain.replace(/^\./, "");
            return (domain === "connect.garmin.com" || "connect.garmin.com".endsWith(`.${domain}`))
              && "/gc-api/".startsWith(cookie.path);
          });
          const captured = {
            cookies: pageCookies.map(c => `${c.name}=${c.value}`).join("; "),
            csrfToken,
            capturedAt: Date.now(),
          };
          // A pre-login CSRF token is not proof of authentication. Keep waiting
          // through redirects/MFA until the API accepts the captured session.
          if (captured.cookies && await this.probe(captured)) { candidate = captured; break; }
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      if (!candidate) throw new Error("Timed out waiting for login after 5 minutes. Run authenticate_garmin to resume sign-in in the same browser.");

      console.error("✅ Authentication successful!");
      this.storeAuth(candidate);
      authData = candidate;
    } finally {
      // Keep the dedicated browser reusable after a client timeout/restart.
      await browser.disconnect();
    }

    return authData;
  }

  private loadStoredAuth(): AuthData | null {
    try {
      if (!existsSync(this.authFile)) {
        return null;
      }
      const parsed = JSON.parse(readFileSync(this.authFile, "utf8"));
      if (typeof parsed?.cookies !== "string" || !parsed.cookies || typeof parsed?.csrfToken !== "string" || !parsed.csrfToken || !Number.isFinite(parsed?.capturedAt)) {
        return null;
      }
      return parsed as AuthData;
    } catch {
      // JSON parser errors can contain excerpts of the credential file.
      console.error("Stored Garmin session could not be read. Re-authenticate to replace it.");
      return null;
    }
  }

  private storeAuth(authData: AuthData): void {
    mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    const temporary = `${this.authFile}.${process.pid}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(authData, null, 2), { mode: 0o600 });
      chmodSync(temporary, 0o600);
      renameSync(temporary, this.authFile);
    } finally {
      rmSync(temporary, { force: true });
    }
  }

  /** Close only the package's isolated browser, then remove local sign-in data. */
  async logout(): Promise<void> {
    const session = new LoginSession(this.configDir);
    const guard = join(this.configDir, "login-claim.lock");
    try {
      mkdirSync(guard, { mode: 0o700 });
    } catch {
      throw new GarminError("LOGIN_BUSY", "Login coordination is busy. Wait for it to finish before disconnecting.");
    }
    try {
      if (session.isRunning()) throw new GarminError("LOGIN_BUSY", "A Garmin login is running. Close its login window and wait for the helper to finish, then disconnect again.");
      let endpoint: string | null = null;
      try {
        const [port, path] = readFileSync(join(this.browserProfileDir, "DevToolsActivePort"), "utf8").trim().split("\n");
        if (/^\d+$/.test(port) && /^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(path)) endpoint = `ws://127.0.0.1:${port}${path}`;
      } catch { /* Profile was never launched. */ }
      if (endpoint) {
        let browser;
        try { browser = await puppeteer.connect({ browserWSEndpoint: endpoint, protocolTimeout: 10000 }); }
        catch { /* Stale DevToolsActivePort from a closed browser. */ }
        if (browser) {
          try { await browser.close(); }
          catch { throw new GarminError("LOGIN_BUSY", "Could not close the dedicated Garmin browser. Close it manually, then disconnect again."); }
        }
      }
      for (const path of [this.authFile, this.browserProfileDir, join(this.configDir, "login-status.json"), join(this.configDir, "login.lock")]) rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } finally { rmSync(guard, { recursive: true, force: true }); }
  }
}

/** Actionable categories; do not return raw browser logs or credential-bearing URLs. */
export function browserLaunchMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/already running|SingletonLock|ProcessSingleton/i.test(message)) {
    return "The Garmin login profile is busy. Close its Google Chrome for Testing window, then run authenticate_garmin again. Your personal browser can stay open.";
  }
  if (/could not find|browser was not found|executable.*(exist|found)|ENOENT/i.test(message)) {
    return "Chrome is missing. Run setup_garmin with installBrowser=true, or CLI setup --install-browser, or set GARMIN_BROWSER_PATH to a Chrome/Chromium executable.";
  }
  if (/display|X server|platform.*initializ/i.test(message)) {
    return "Garmin browser login needs a local graphical display. Run the package on your desktop rather than a headless server.";
  }
  return "Could not open the Garmin login browser. Check GARMIN_BROWSER_PATH and whether the dedicated login browser can start on this desktop.";
}
