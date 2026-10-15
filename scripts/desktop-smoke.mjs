import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { getMcpConfigForManifest, VERSIONED_MANIFEST_SCHEMAS, hasRequiredConfigMissing } from '@anthropic-ai/mcpb';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const root = mkdtempSync(join(tmpdir(), 'garmin-desktop-smoke-'));
try {
  const entries = unzipSync(readFileSync(`release/garmin-workouts-${version}.mcpb`));
  for (const [path, bytes] of Object.entries(entries)) {
    const destination = resolve(root, path); assert(destination.startsWith(root + sep));
    mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, bytes);
  }
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  VERSIONED_MANIFEST_SCHEMAS['0.3'].parse(manifest);
  assert.equal(manifest.version, version); assert.equal(hasRequiredConfigMissing({ manifest }), false);
  const config = await getMcpConfigForManifest({ manifest, extensionPath: root, systemDirs: { HOME: root }, userConfig: {}, pathSeparator: sep });
  assert(config); assert(!config.args.some(arg => arg.includes('${')));
  const client = new Client({ name: 'claude-extension-smoke', version: '1.0.0' });
  const env = { ...process.env, ...config.env, GARMIN_CONFIG_DIR: join(root, 'session'), GARMIN_BROWSER_PATH: join(root, 'missing-chrome') };
  try {
    // The host substitutes its Node runtime for the manifest's "node" command.
    await client.connect(new StdioClientTransport({ command: process.execPath, args: config.args, env, cwd: root, stderr: 'pipe' }));
    assert(client.getInstructions().includes('connect_garmin'));
    const tools = (await client.listTools()).tools;
    assert.deepEqual(tools.map(tool => tool.name).sort(), manifest.tools.map(tool => tool.name).sort());
    assert.equal(tools.length, 12);
    assert.deepEqual((await client.listPrompts()).prompts.map(prompt => prompt.name), ['garmin_setup']);
    const prompt = await client.getPrompt({ name: 'garmin_setup' }); assert(prompt.messages[0].content.text.includes('connect_garmin'));
    const connected = await client.callTool({ name: 'connect_garmin', arguments: { installBrowser: false } });
    assert.equal(connected.structuredContent.state, 'pending');
    let progress;
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      progress = await client.callTool({ name: 'check_garmin_auth', arguments: {} });
      if (progress.structuredContent.code === 'SETUP_REQUIRED') break;
    }
    assert.equal(progress.structuredContent.code, 'SETUP_REQUIRED');
    assert.equal((await client.callTool({ name: 'disconnect_garmin', arguments: {} })).structuredContent.ok, true);
  } finally { await client.close(); }
  const pluginRoot = join(root, 'plugin files with spaces'); mkdirSync(pluginRoot);
  const pluginFiles = unzipSync(readFileSync(`release/garmin-workouts-plugin-${version}.zip`));
  for (const [path, bytes] of Object.entries(pluginFiles)) {
    const target = resolve(pluginRoot, path); assert(target.startsWith(pluginRoot + sep));
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes);
  }
  const installer = await import(pathToFileURL(join(pluginRoot, 'dist', 'install-plugin.js')));
  const testHome = join(root, 'simulated user home'); mkdirSync(testHome);
  const installed = installer.installCodexPlugin({ homeDirectory: testHome });
  assert.equal(installed.version, version);
  const registered = JSON.parse(readFileSync(installed.marketplaceFile, 'utf8'));
  assert.equal(registered.plugins[0].source.path, `./.codex/plugins/garmin-workouts/${version}`);
  assert.equal(JSON.parse(readFileSync(join(installed.directory, 'plugin.json'), 'utf8')).version, version);
  assert.equal(installer.installCodexPlugin({ homeDirectory: testHome }).backup, undefined);
  const launcher = join(pluginRoot, 'installers', process.platform === 'win32' ? 'Install-Garmin-Workouts.cmd' : 'Install-Garmin-Workouts.command');
  const output = process.platform === 'win32'
    ? execFileSync('cmd.exe', ['/d', '/s', '/c', `""${launcher}" --check"`], { windowsVerbatimArguments: true, encoding: 'utf8' })
    : execFileSync('bash', [launcher, '--check'], { encoding: 'utf8' });
  assert.equal(output.trim(), version);
  console.log(`Claude MCPB: schema, host configuration, tools, setup prompt and detached helper pass on Node ${process.versions.node} (${process.platform}).`);
} finally { rmSync(root, { recursive: true, force: true }); }
