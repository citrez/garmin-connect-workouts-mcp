import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { GarminError } from "./errors.js";
import { VERSION } from "./version.js";

const NAME = "garmin-workouts";
const MARKER = ".garmin-workouts-install.json";
const files = ["dist", "skills", "assets", "docs", "plugin.json", "mcp.json", ".codex-plugin", "package.json", "LICENSE", "README.md"];

/** A per-user install: immutable version folders and a merged, backed-up marketplace. */
export function installCodexPlugin(options: { homeDirectory?: string; packageDirectory?: string } = {}) {
  const home = resolve(options.homeDirectory || homedir());
  const source = options.packageDirectory || fileURLToPath(new URL("../", import.meta.url));
  const marketplaceDirectory = join(home, ".agents", "plugins");
  const marketplaceFile = join(marketplaceDirectory, "marketplace.json");
  mkdirSync(marketplaceDirectory, { recursive: true, mode: 0o700 });
  const lock = join(marketplaceDirectory, ".garmin-install.lock");
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch { throw new GarminError("SETUP_REQUIRED", "Another Garmin plugin installation is running. Wait for it to finish. If it was interrupted, remove .garmin-install.lock from your personal marketplace directory and retry."); }
  let staging: string | undefined;
  let createdDestination = false;
  let temporary: string | undefined;
  const destination = join(home, ".codex", "plugins", NAME, VERSION);
  try {
    let original: string | undefined;
    let marketplace: Record<string, any> = { name: "personal", interface: { displayName: "Personal" }, plugins: [] };
    if (existsSync(marketplaceFile)) {
      if (lstatSync(marketplaceFile).isSymbolicLink()) throw new GarminError("SETUP_REQUIRED", "Your marketplace file is a symbolic link. Register this plugin manually using the distribution guide.");
      original = readFileSync(marketplaceFile, "utf8");
      try { marketplace = JSON.parse(original); }
      catch { throw new GarminError("SETUP_REQUIRED", "Your existing marketplace JSON could not be parsed. Fix it before installing; it has not been overwritten."); }
      if (!marketplace || typeof marketplace !== "object" || typeof marketplace.name !== "string" || !Array.isArray(marketplace.plugins)) throw new GarminError("SETUP_REQUIRED", "Your existing marketplace has an unsupported structure. It has not been overwritten.");
    }
    const current = marketplace.plugins.find((entry: any) => entry?.name === NAME);
    if (current) {
      const owned = current.source?.source === "local" && typeof current.source.path === "string" && current.source.path.startsWith("./.codex/plugins/garmin-workouts/") || current.source?.source === "npm" && current.source.package === "@citrez/garmin-connect-workouts-mcp";
      if (!owned) throw new GarminError("SETUP_REQUIRED", "Your marketplace already has a different plugin named garmin-workouts. Rename that entry or install this package manually; the existing entry has not been changed.");
    }
    const manifest = JSON.parse(readFileSync(join(source, "plugin.json"), "utf8"));
    if (manifest.name !== NAME || manifest.version !== VERSION || !existsSync(join(source, "dist", "cli.js"))) throw new GarminError("SETUP_REQUIRED", "The plugin package is incomplete or its version does not match. Download the release again.");
    const parent = dirname(destination);
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    if (existsSync(destination)) {
      let marker;
      try { marker = JSON.parse(readFileSync(join(destination, MARKER), "utf8")); } catch { /* An unowned folder must never be replaced. */ }
      if (lstatSync(destination).isSymbolicLink() || marker?.name !== NAME || marker?.version !== VERSION) throw new GarminError("SETUP_REQUIRED", "The target plugin folder already exists and was not created by this installer. It has not been replaced.");
      for (const path of files) if (!existsSync(join(destination, path))) throw new GarminError("SETUP_REQUIRED", "The installed plugin is incomplete. Remove its version folder and install again; other plugins are unchanged.");
    } else {
      staging = mkdtempSync(join(parent, ".install-"));
      for (const path of files) cpSync(join(source, path), join(staging, path), { recursive: true });
      writeFileSync(join(staging, MARKER), JSON.stringify({ name: NAME, version: VERSION }), { mode: 0o600 });
      renameSync(staging, destination); staging = undefined; createdDestination = true;
    }
    const entry = {
      ...current, name: NAME,
      source: { source: "local", path: "./" + relative(home, destination).split(sep).join("/") },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL", ...current?.policy },
      category: current?.category || "Productivity",
    };
    marketplace.plugins = current ? marketplace.plugins.map((item: any) => item === current ? entry : item) : [...marketplace.plugins, entry];
    const updated = JSON.stringify(marketplace, null, 2) + "\n";
    let backup: string | undefined;
    if (original !== updated) {
      if (original !== undefined) {
        backup = marketplaceFile + ".backup-" + randomUUID();
        writeFileSync(backup, original, { mode: 0o600 });
      }
      temporary = marketplaceFile + "." + randomUUID() + ".tmp";
      writeFileSync(temporary, updated, { mode: 0o600 });
      renameSync(temporary, marketplaceFile); temporary = undefined;
    }
    return { version: VERSION, directory: destination, marketplaceFile, marketplaceName: marketplace.name, ...(backup ? { backup } : {}), message: "Garmin Workouts is registered. Restart ChatGPT/Codex desktop, select your personal marketplace in Plugins, install Garmin Workouts, then say: Connect my Garmin." };
  } catch (error) {
    if (createdDestination) rmSync(destination, { recursive: true, force: true });
    throw error;
  } finally {
    if (temporary) rmSync(temporary, { force: true });
    if (staging) rmSync(staging, { recursive: true, force: true });
    rmSync(lock, { recursive: true, force: true });
  }
}
