import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const adapter = vi.hoisted(() => ({ connect: vi.fn(), close: vi.fn() }));
vi.mock('puppeteer-core', () => ({ default: adapter }));
const discovery = vi.hoisted(() => ({ system: vi.fn(), installed: vi.fn(), install: vi.fn() }));
vi.mock('@puppeteer/browsers', () => ({ Browser: { CHROME: 'chrome' }, ChromeReleaseChannel: { STABLE: 'stable' }, computeSystemExecutablePath: discovery.system, getInstalledBrowsers: discovery.installed, install: discovery.install }));
import { GarminAuth } from '../src/garmin-auth.js';
import { LoginSession } from '../src/login-session.js';
import { ensureBrowser, findBrowser } from '../src/browser.js';
import { doctor } from '../src/doctor.js';

let directory: string;
beforeEach(() => {
  vi.resetAllMocks();
  directory = mkdtempSync(join(tmpdir(), 'garmin-setup-'));
  vi.stubEnv('GARMIN_CONFIG_DIR', join(directory, 'session'));
  vi.stubEnv('GARMIN_BROWSER_PATH', '');
  discovery.system.mockImplementation(() => { throw new Error('not installed'); });
  discovery.installed.mockResolvedValue([]);
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });
function executable() { const path = join(directory, 'chrome'); writeFileSync(path, '', { mode: 0o700 }); return path; }

describe('setup and disconnect', () => {
  it('honors an explicit executable without downloading anything', async () => {
    const path = executable(); vi.stubEnv('GARMIN_BROWSER_PATH', path);
    expect(await ensureBrowser(true)).toBe(path); expect(discovery.install).not.toHaveBeenCalled();
  });
  it('does not silently fall back when the configured browser is invalid', async () => {
    vi.stubEnv('GARMIN_BROWSER_PATH', join(directory, 'missing'));
    await expect(ensureBrowser(true)).rejects.toMatchObject({ code: 'SETUP_REQUIRED' });
    expect(discovery.install).not.toHaveBeenCalled();
  });
  it('detects system Chrome without downloading it', async () => {
    const path = executable(); discovery.system.mockReturnValue(path);
    expect(await findBrowser()).toBe(path);
    expect(discovery.install).not.toHaveBeenCalled();
  });
  it('doctor with connection check creates no storage when no account exists', async () => {
    discovery.system.mockReturnValue(executable());
    const report = await doctor(true);
    expect(report.checks.find(check => check.name === 'session')?.ok).toBe(false);
    expect(existsSync(join(directory, 'session'))).toBe(false);
  });
  it('disconnect removes local login state but retains browser downloads and unrelated files', async () => {
    const path = join(directory, 'session'); mkdirSync(path);
    writeFileSync(join(path, 'auth.json'), '{"cookies":"test"}');
    writeFileSync(join(path, 'login-status.json'), '{}');
    mkdirSync(join(path, 'browser-profile')); mkdirSync(join(path, 'browsers'));
    writeFileSync(join(path, 'unrelated.txt'), 'keep');
    await new GarminAuth(path).logout();
    for (const file of ['auth.json', 'login-status.json', 'browser-profile']) expect(existsSync(join(path, file))).toBe(false);
    expect(existsSync(join(path, 'browsers'))).toBe(true);
    expect(readFileSync(join(path, 'unrelated.txt'), 'utf8')).toBe('keep');
    await new GarminAuth(path).logout();
  });
  it('refuses disconnect while a login helper owns the profile', async () => {
    const path = join(directory, 'session'); const session = new LoginSession(path); session.claim();
    writeFileSync(join(path, 'auth.json'), 'keep');
    await expect(new GarminAuth(path).logout()).rejects.toMatchObject({ code: 'LOGIN_BUSY' });
    expect(readFileSync(join(path, 'auth.json'), 'utf8')).toBe('keep');
    expect(existsSync(join(path, 'login-claim.lock'))).toBe(false);
    session.release();
  });
  it('closes only the isolated browser before removing its profile', async () => {
    const path = join(directory, 'session'); mkdirSync(join(path, 'browser-profile'), { recursive: true });
    writeFileSync(join(path, 'browser-profile', 'DevToolsActivePort'), '12345\n/devtools/browser/test-id\n');
    adapter.connect.mockResolvedValue({ close: adapter.close });
    await new GarminAuth(path).logout();
    expect(adapter.connect).toHaveBeenCalledWith(expect.objectContaining({ browserWSEndpoint: 'ws://127.0.0.1:12345/devtools/browser/test-id' }));
    expect(adapter.close).toHaveBeenCalledOnce();
    expect(existsSync(join(path, 'browser-profile'))).toBe(false);
  });
});
