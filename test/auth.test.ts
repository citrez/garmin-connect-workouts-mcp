import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, statSync, readFileSync, existsSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GarminAuth, browserLaunchMessage } from "../src/garmin-auth.js";
import { LoginSession } from "../src/login-session.js";

const directories: string[] = [];
function temporary() { const path = mkdtempSync(join(tmpdir(), "garmin-auth-test-")); directories.push(path); return path; }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); directories.forEach(path => rmSync(path, { recursive: true, force: true })); directories.length = 0; });

describe("login coordination", () => {
  it("coalesces login attempts across MCP instances sharing a directory", () => {
    const path = temporary(); const first = new LoginSession(path); const second = new LoginSession(path);
    expect(first.claim()).toBe(true);
    expect(second.claim()).toBe(false);
    expect(second.read()?.state).toBe("pending");
    first.write({ state: "success", message: "Complete" }); first.release();
    expect(second.read()).toEqual({ state: "success", message: "Complete" });
    expect(second.claim()).toBe(true); second.release();
  });

  it("recovers an abandoned owner without killing a process", () => {
    const path = temporary(); const lock = join(path, "login.lock"); mkdirSync(lock);
    writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: 123456 }));
    const kill = vi.spyOn(process, "kill").mockImplementation(() => { throw Object.assign(new Error("gone"), { code: "ESRCH" }); });
    const session = new LoginSession(path);
    expect(session.claim()).toBe(true); session.release();
    expect(kill).toHaveBeenCalledWith(123456, 0);
  });

  it("does not steal a lock while its metadata is being created", () => {
    const path = temporary(); mkdirSync(join(path, "login.lock"));
    expect(new LoginSession(path).claim()).toBe(false);
  });

  it("reports interrupted helpers and persists errors between clients", () => {
    const path = temporary(); const session = new LoginSession(path);
    session.write({ state: "pending", message: "Starting" });
    expect(session.read()?.message).toContain("stopped before completing");
    session.write({ state: "error", message: "Chrome is missing" });
    expect(new LoginSession(path).read()?.message).toBe("Chrome is missing");
    if (process.platform !== "win32") expect(statSync(join(path, "login-status.json")).mode & 0o777).toBe(0o600);
  });

  it("explains interrupted lock recovery rather than stealing the guard", () => {
    const path = temporary(); const guard = join(path, "login-claim.lock"); mkdirSync(guard);
    utimesSync(guard, new Date(0), new Date(0));
    expect(() => new LoginSession(path).claim()).toThrow("Login coordination was interrupted");
    expect(existsSync(guard)).toBe(true);
  });
});

describe("Garmin session handling", () => {
  it("validates credentials before returning them and bounds requests", async () => {
    const path = temporary(); const auth = { cookies: "example=test", csrfToken: "test", capturedAt: 1 };
    writeFileSync(join(path, "auth.json"), JSON.stringify(auth));
    const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch);
    expect(await new GarminAuth(path).getValidAuth()).toEqual(auth);
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetch.mock.calls[0][1].redirect).toBe("error");
    fetch.mockResolvedValue({ ok: false, status: 401 });
    expect(await new GarminAuth(path).getValidAuth()).toBeNull();
  });

  it("replaces an existing permissive credentials file with owner-only permissions", () => {
    const path = temporary(); const file = join(path, "auth.json"); writeFileSync(file, "old", { mode: 0o644 });
    const auth = new GarminAuth(path);
    // Exercise storage separately from the interactive browser.
    (auth as any).storeAuth({ cookies: "test", csrfToken: "test", capturedAt: 1 });
    if (process.platform !== "win32") expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(file, "utf8")).cookies).toBe("test");
  });

  it("distinguishes missing Chrome, profile locks and display failures", () => {
    expect(browserLaunchMessage(new Error("The browser is already running"))).toContain("profile is busy");
    expect(browserLaunchMessage(new Error("Could not find Chrome"))).toContain("GARMIN_BROWSER_PATH");
    expect(browserLaunchMessage(new Error("Missing X server or DISPLAY"))).toContain("graphical display");
    expect(browserLaunchMessage(new Error("secret https://example.com?token=private"))).not.toContain("private");
  });
});
