import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installCodexPlugin } from '../src/install-plugin.js';
import { VERSION } from '../src/version.js';

const directories: string[] = [];
afterEach(() => { for (const path of directories) rmSync(path, { recursive: true, force: true }); directories.length = 0; });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'garmin-install-')); directories.push(root);
  const home = join(root, 'home'); const source = join(root, 'package'); mkdirSync(home); mkdirSync(source);
  for (const dir of ['dist', 'skills', 'assets', 'docs', '.codex-plugin']) mkdirSync(join(source, dir));
  writeFileSync(join(source, 'plugin.json'), JSON.stringify({ name: 'garmin-workouts', version: VERSION }));
  writeFileSync(join(source, 'mcp.json'), '{}'); writeFileSync(join(source, 'package.json'), '{}');
  writeFileSync(join(source, 'dist', 'cli.js'), 'standalone bundle');
  for (const file of ['LICENSE', 'README.md']) writeFileSync(join(source, file), 'test');
  const marketplaceDirectory = join(home, '.agents', 'plugins'); mkdirSync(marketplaceDirectory, { recursive: true });
  const marketplaceFile = join(marketplaceDirectory, 'marketplace.json');
  return { home, source, marketplaceDirectory, marketplaceFile, install: () => installCodexPlugin({ homeDirectory: home, packageDirectory: source }) };
}

describe('personal plugin installation', () => {
  it('copies the package to a stable versioned folder and registers portable paths', () => {
    const f = fixture(); const result = f.install();
    expect(readFileSync(join(result.directory, 'dist', 'cli.js'), 'utf8')).toBe('standalone bundle');
    const config = JSON.parse(readFileSync(f.marketplaceFile, 'utf8'));
    expect(config.plugins[0].source).toEqual({ source: 'local', path: `./.codex/plugins/garmin-workouts/${VERSION}` });
    expect(config.plugins[0].policy.authentication).toBe('ON_INSTALL');
  });
  it('preserves other plugins, marketplace metadata and original bytes in a backup', () => {
    const f = fixture(); const original = JSON.stringify({ name: 'my-plugins', interface: { displayName: 'My plugins' }, plugins: [{ name: 'other', source: './other' }] });
    writeFileSync(f.marketplaceFile, original);
    const result = f.install(); const updated = JSON.parse(readFileSync(f.marketplaceFile, 'utf8'));
    expect(updated.name).toBe('my-plugins'); expect(updated.interface.displayName).toBe('My plugins');
    expect(updated.plugins[0]).toEqual({ name: 'other', source: './other' });
    expect(readFileSync(result.backup!, 'utf8')).toBe(original);
  });
  it('is idempotent and retains explicit installation policy', () => {
    const f = fixture(); f.install();
    const config = JSON.parse(readFileSync(f.marketplaceFile, 'utf8')); config.plugins[0].policy.installation = 'NOT_AVAILABLE'; writeFileSync(f.marketplaceFile, JSON.stringify(config));
    f.install(); const before = readFileSync(f.marketplaceFile, 'utf8'); const result = f.install();
    expect(readFileSync(f.marketplaceFile, 'utf8')).toBe(before); expect(result.backup).toBeUndefined();
    expect(JSON.parse(before).plugins[0].policy.installation).toBe('NOT_AVAILABLE');
  });
  it('does not overwrite malformed configuration', () => {
    const f = fixture(); writeFileSync(f.marketplaceFile, '{invalid');
    expect(f.install).toThrow('could not be parsed'); expect(readFileSync(f.marketplaceFile, 'utf8')).toBe('{invalid');
    expect(existsSync(join(f.marketplaceDirectory, '.garmin-install.lock'))).toBe(false);
  });
  it('refuses unrelated plugins with the same name', () => {
    const f = fixture(); const original = JSON.stringify({ name: 'mine', plugins: [{ name: 'garmin-workouts', source: './my-custom-plugin' }] }); writeFileSync(f.marketplaceFile, original);
    expect(f.install).toThrow('different plugin'); expect(readFileSync(f.marketplaceFile, 'utf8')).toBe(original);
  });
  it('does not replace unowned files in an existing version folder', () => {
    const f = fixture(); const destination = join(f.home, '.codex', 'plugins', 'garmin-workouts', VERSION); mkdirSync(destination, { recursive: true }); writeFileSync(join(destination, 'user.txt'), 'keep');
    expect(f.install).toThrow('not created by this installer'); expect(readFileSync(join(destination, 'user.txt'), 'utf8')).toBe('keep');
    expect(existsSync(f.marketplaceFile)).toBe(false);
  });
  it('cleans up a failed copy and leaves the marketplace unchanged', () => {
    const f = fixture(); writeFileSync(f.marketplaceFile, '{"name":"mine","plugins":[]}'); rmSync(join(f.source, 'README.md'));
    expect(f.install).toThrow(); expect(JSON.parse(readFileSync(f.marketplaceFile, 'utf8')).plugins).toEqual([]);
    expect(readdirSync(join(f.home, '.codex', 'plugins', 'garmin-workouts'))).toEqual([]);
  });
});
