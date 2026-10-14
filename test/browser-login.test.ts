import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const adapter = vi.hoisted(() => ({ connect: vi.fn(), launch: vi.fn() }));
vi.mock("puppeteer-core", () => ({ default: adapter }));
vi.mock("../src/browser.js", () => ({ ensureBrowser: vi.fn(async () => "/test/chrome") }));
import { GarminAuth } from "../src/garmin-auth.js";

let directory: string;
let browser: any;
let page: any;
let requestListener: (request: any) => void;
beforeEach(() => {
  vi.clearAllMocks();
  directory = mkdtempSync(join(tmpdir(), "garmin-browser-test-"));
  mkdirSync(join(directory, "browser-profile"));
  writeFileSync(join(directory, "browser-profile", "DevToolsActivePort"), "12345\n/devtools/browser/test-id\n");
  page = {
    setViewport: vi.fn(), isClosed: vi.fn(() => false), url: vi.fn(() => "https://connect.garmin.com/app/workouts"),
    on: vi.fn((_event, listener) => { requestListener = listener; }),
    goto: vi.fn(async () => {
      requestListener({ url: () => "https://example.com/gc-api/steal", headers: () => ({ "connect-csrf-token": "foreign" }) });
      requestListener({ url: () => "https://connect.garmin.com/gc-api/workout-service/workouts", headers: () => ({ "connect-csrf-token": "garmin" }) });
    }),
  };
  browser = {
    connected: true, newPage: vi.fn(async () => page), disconnect: vi.fn(), close: vi.fn(),
    cookies: vi.fn(async () => [
      { domain: ".garmin.com", path: "/", name: "session", value: "test" },
      { domain: "example.com", path: "/", name: "foreign", value: "secret" },
      { domain: ".garmin.com", path: "/signin", name: "signin", value: "other" },
    ]),
  };
  adapter.connect.mockResolvedValue(browser); adapter.launch.mockResolvedValue(browser);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); rmSync(directory, { recursive: true, force: true }); });

describe("interactive browser adapter", () => {
  it("reuses the isolated browser and captures only Garmin API credentials", async () => {
    const auth = await new GarminAuth(directory).authenticate();
    expect(adapter.connect).toHaveBeenCalledWith(expect.objectContaining({ browserWSEndpoint: "ws://127.0.0.1:12345/devtools/browser/test-id" }));
    expect(adapter.launch).not.toHaveBeenCalled();
    expect(auth?.csrfToken).toBe("garmin");
    expect(auth?.cookies).toBe("session=test");
    expect(JSON.parse(readFileSync(join(directory, "auth.json"), "utf8"))).toEqual(auth);
    expect(browser.disconnect).toHaveBeenCalled(); expect(browser.close).not.toHaveBeenCalled();
  });

  it("reconnects if another client launches the profile during a launch race", async () => {
    adapter.connect.mockRejectedValueOnce(new Error("not running yet"));
    adapter.launch.mockRejectedValueOnce(new Error("The browser is already running"));
    expect(await new GarminAuth(directory).authenticate()).not.toBeNull();
    expect(adapter.connect).toHaveBeenCalledTimes(2);
  });

  it("waits for authenticated API acceptance rather than accepting a pre-login token", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch);
    const promise = new GarminAuth(directory).authenticate();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await promise).not.toBeNull(); expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reports a closed login window and disconnects cleanly", async () => {
    page.isClosed.mockReturnValue(true);
    await expect(new GarminAuth(directory).authenticate()).rejects.toThrow("Login window closed");
    expect(browser.disconnect).toHaveBeenCalled();
  });

  it("reports a bounded timeout when login never succeeds", async () => {
    vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401 })));
    const assertion = expect(new GarminAuth(directory).authenticate()).rejects.toThrow("Timed out waiting for login");
    await vi.advanceTimersByTimeAsync(300000); await assertion;
    expect(browser.disconnect).toHaveBeenCalled();
  });
});
