import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import puppeteer from 'puppeteer-core';

const root = resolve('.');
const work = mkdtempSync(join(tmpdir(), 'garmin-package-smoke-'));
const metadata = JSON.parse(readFileSync('package.json', 'utf8'));
const npm = process.env.npm_execpath;
assert(npm, 'Run this script with npm run test:package');
function run(args, options = {}) {
  return execFileSync(process.execPath, [npm, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options });
}
try {
  const packed = JSON.parse(run(['pack', '--ignore-scripts', '--json', '--pack-destination', work]))[0];
  for (const file of ['dist/cli.js', 'dist/mcp-server.js', 'dist/login-worker.js', 'dist/THIRD_PARTY_NOTICES.txt', 'plugin.json', 'mcp.json', 'skills/garmin-setup/SKILL.md', 'skills/garmin-workouts/SKILL.md']) assert(packed.files.some(item => item.path === file), `Missing ${file}`);
  assert(!packed.files.some(item => /auth\.json|browser-profile|fixtures|\.env/.test(item.path)));
  const installDir = join(work, 'clean-install'); mkdirSync(installDir);
  writeFileSync(join(installDir, 'package.json'), '{"private":true}');
  run(['install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', join(work, packed.filename)], { cwd: installDir });
  const packageDir = join(installDir, 'node_modules', '@citrez', 'garmin-connect-workouts-mcp');
  assert(!existsSync(join(packageDir, 'node_modules')), 'Bundle should not require nested dependencies');
  const cli = join(packageDir, 'dist', 'cli.js');
  const env = { ...process.env, GARMIN_CONFIG_DIR: join(work, 'session'), GARMIN_BROWSER_PATH: join(work, 'missing-browser') };
  assert.equal(execFileSync(process.execPath, [cli, '--version'], { env, encoding: 'utf8' }).trim(), metadata.version);
  const diagnosis = spawnSync(process.execPath, [cli, 'doctor', '--json'], { env, encoding: 'utf8' });
  assert.equal(diagnosis.status, 1);
  const report = JSON.parse(diagnosis.stdout);
  assert.equal(report.checks.find(check => check.name === 'node').ok, true);
  assert.equal(report.checks.find(check => check.name === 'browser').ok, false);
  assert(!existsSync(env.GARMIN_CONFIG_DIR), 'Read-only doctor must not create storage');
  const client = new Client({ name: 'package-smoke', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [cli], env, stderr: 'pipe' });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 12);
    assert(tools.tools.every(tool => tool.outputSchema));
    const auth = await client.callTool({ name: 'check_garmin_auth', arguments: {} });
    assert.equal(auth.isError, true); assert.equal(auth.structuredContent.code, 'AUTH_REQUIRED');
    const create = await client.callTool({ name: 'create_garmin_workout', arguments: { name: 'Offline test', steps: [{ kind: 'step', intensity: 'warmup', duration: { type: 'lapButton' } }] } });
    assert.equal(create.structuredContent.code, 'AUTH_REQUIRED');
    const disconnected = await client.callTool({ name: 'disconnect_garmin', arguments: {} });
    assert.equal(disconnected.structuredContent.ok, true);
    const badSetup = await client.callTool({ name: 'setup_garmin', arguments: {} });
    assert.equal(badSetup.structuredContent.code, 'SETUP_REQUIRED');
    const login = await client.callTool({ name: 'authenticate_garmin', arguments: {} });
    assert.equal(login.structuredContent.state, 'pending');
    let status;
    for (let attempt = 0; attempt < 50; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      status = await client.callTool({ name: 'check_garmin_auth', arguments: {} });
      if (status.structuredContent.code === 'SETUP_REQUIRED') break;
    }
    assert.equal(status.structuredContent.code, 'SETUP_REQUIRED', 'Packaged detached helper reports a missing browser');
    assert.equal((await client.callTool({ name: 'disconnect_garmin', arguments: {} })).structuredContent.ok, true);
  } finally { await client.close(); }
  if (process.argv.includes('--browser-smoke')) {
    delete process.env.GARMIN_BROWSER_PATH;
    process.env.GARMIN_CONFIG_DIR = join(work, 'browser-test');
    // Provision a browser through the installed standalone CLI.
    const setupEnv = { ...process.env, DISPLAY: process.env.DISPLAY || ':99' };
    delete setupEnv.GARMIN_BROWSER_PATH;
    const setupOutput = JSON.parse(execFileSync(process.execPath, [cli, 'setup', '--install-browser', '--json'], { env: setupEnv, encoding: 'utf8' }));
    const browserCheck = setupOutput.checks.find(check => check.name === 'browser');
    assert(browserCheck.ok);
    const executablePath = browserCheck.message.slice('Chrome found: '.length);
    const browser = await puppeteer.launch({ headless: true, executablePath, userDataDir: join(work, 'headless-profile'), args: process.getuid?.() === 0 ? ['--no-sandbox'] : [] });
    try {
      const page = await browser.newPage();
      await page.setContent('<title>Garmin package smoke</title><h1>Browser ready</h1>');
      assert.equal(await page.title(), 'Garmin package smoke');
      assert((await browser.version()).includes('Chrome'));
    } finally { await browser.close(); }
  }
  console.log(`Package installation, CLI, and MCP checks passed on ${process.platform}.`);
} finally { rmSync(work, { recursive: true, force: true }); }
