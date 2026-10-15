import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const archive = unzipSync(readFileSync(`release/garmin-workouts-plugin-${version}.zip`));
const root = mkdtempSync(join(tmpdir(), 'garmin-plugin-smoke-'));
try {
  for (const [path, data] of Object.entries(archive)) {
    const target = resolve(root, path); assert(target.startsWith(root + sep)); // ZIP contains files only.
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, data);
  }
  assert(!existsSync(join(root, 'node_modules')));
  const manifest = JSON.parse(readFileSync(join(root, 'plugin.json'), 'utf8'));
  assert.equal(manifest.version, version);
  assert(existsSync(join(root, manifest.extensions['com.openai'].onboardingSkill)));
  const config = JSON.parse(readFileSync(join(root, 'mcp.json'), 'utf8')).mcpServers['garmin-workouts'];
  const args = config.args.map(value => value.replaceAll('${PLUGIN_ROOT}', root));
  assert.equal(execFileSync(process.execPath, [...args, '--version'], { encoding: 'utf8' }).trim(), version);
  const env = { ...process.env, GARMIN_CONFIG_DIR: join(root, 'test-session') };
  const client = new Client({ name: 'plugin-zip-smoke', version: '1.0.0' });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args, cwd: root, env, stderr: 'pipe' }));
    assert.equal((await client.listTools()).tools.length, 12);
    const result = await client.callTool({ name: 'check_garmin_auth', arguments: {} });
    assert.equal(result.structuredContent.code, 'AUTH_REQUIRED');
  } finally { await client.close(); }
  console.log(`Standalone plugin ZIP works without node_modules on ${process.platform}.`);
} finally { rmSync(root, { recursive: true, force: true }); }
