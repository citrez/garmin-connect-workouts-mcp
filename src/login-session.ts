import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const configDirectory = () => process.env.GARMIN_CONFIG_DIR || join(homedir(), ".config", "garmin-connect-workouts-mcp");
export type LoginStatus = { state: "pending" | "success" | "error"; message: string };

/** Shared state contains progress only, never cookies, passwords or tokens. */
export class LoginSession {
  private lock: string;
  private statusFile: string;
  constructor(private directory = configDirectory()) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.lock = join(directory, "login.lock");
    this.statusFile = join(directory, "login-status.json");
  }

  isRunning(): boolean {
    try {
      const { pid } = JSON.parse(readFileSync(join(this.lock, "owner.json"), "utf8"));
      if (!Number.isSafeInteger(pid) || pid <= 0) return true;
      try { process.kill(pid, 0); return true; }
      catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
    } catch {
      // A newly acquired lock may not have its owner metadata yet.
      try { return Date.now() - statSync(this.lock).mtimeMs < 15000; }
      catch { return false; }
    }
  }

  claim(): boolean {
    // Serialize stale-lock recovery and acquisition across helper processes.
    const guard = join(this.directory, "login-claim.lock");
    try { mkdirSync(guard, { mode: 0o700 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        if (Date.now() - statSync(guard).mtimeMs > 15000) {
          throw new Error("Login coordination was interrupted. Remove login-claim.lock from the Garmin configuration directory and retry.");
        }
        return false;
      }
      throw error;
    }
    try {
      if (this.isRunning()) return false;
      rmSync(this.lock, { recursive: true, force: true });
      mkdirSync(this.lock, { mode: 0o700 });
      writeFileSync(join(this.lock, "owner.json"), JSON.stringify({ pid: process.pid }), { mode: 0o600 });
      this.write({ state: "pending", message: "Login is in progress. Complete Garmin sign-in and verification in the dedicated Chrome window, then run check_garmin_auth." });
      return true;
    } finally { rmSync(guard, { recursive: true, force: true }); }
  }

  release(): void {
    try {
      const { pid } = JSON.parse(readFileSync(join(this.lock, "owner.json"), "utf8"));
      if (pid === process.pid) rmSync(this.lock, { recursive: true, force: true });
    } catch { /* already released */ }
  }

  write(status: LoginStatus): void {
    const temporary = `${this.statusFile}.${process.pid}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(status), { mode: 0o600 });
      renameSync(temporary, this.statusFile);
    } finally { rmSync(temporary, { force: true }); }
  }

  read(): LoginStatus | null {
    if (this.isRunning()) return { state: "pending", message: "Login is in progress. Complete Garmin sign-in in the dedicated Chrome window, then run check_garmin_auth." };
    try {
      const status = JSON.parse(readFileSync(this.statusFile, "utf8")) as LoginStatus;
      if (status.state === "pending") return { state: "error", message: "The login helper stopped before completing. Run authenticate_garmin to retry." };
      if (["success", "error"].includes(status.state) && typeof status.message === "string") return status;
    } catch { /* no previous attempt */ }
    return null;
  }

  start(): LoginStatus {
    if (this.isRunning()) return this.read()!;
    // A detached helper survives MCP request timeouts and client restarts.
    const worker = fileURLToPath(new URL("./login-worker.js", import.meta.url));
    if (!existsSync(worker)) {
      const status: LoginStatus = { state: "error", message: "The login helper is not built. Run pnpm run build from the package directory and retry." };
      this.write(status);
      return status;
    }
    const child = spawn(process.execPath, [worker], { detached: true, stdio: "ignore", env: { ...process.env, GARMIN_CONFIG_DIR: this.directory } });
    child.on("error", () => this.write({ state: "error", message: "Could not start the login helper. Build the package with pnpm run build and retry." }));
    child.unref();
    return { state: "pending", message: "Login helper started. A dedicated Chrome window will open or be reused. Sign in there, then run check_garmin_auth for progress or a specific error. No password should be entered in chat." };
  }
}
