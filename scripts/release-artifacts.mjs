import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';

const metadata = JSON.parse(readFileSync('package.json', 'utf8'));
const version = metadata.version;
for (const path of ['plugin.json', '.codex-plugin/plugin.json', 'server.json']) assert.equal(JSON.parse(readFileSync(path, 'utf8')).version, version, `${path} version mismatch`);
assert.equal(JSON.parse(readFileSync('server.json', 'utf8')).packages[0].version, version);
const output = resolve('release'); mkdirSync(output, { recursive: true });
const packed = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts', '--json', '--pack-destination', output], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }))[0];
const entries = {};
for (const file of packed.files) {
  const mode = file.path.endsWith('.js') && file.path.startsWith('dist/') ? 0o100755 : 0o100644;
  entries[file.path] = [new Uint8Array(readFileSync(file.path)), { os: 3, attrs: mode << 16 }];
}
// The extracted folder also acts as a local plugin marketplace.
entries['.agents/plugins/marketplace.json'] = new Uint8Array(readFileSync('.agents/plugins/marketplace.json'));
const zipName = `garmin-workouts-plugin-${version}.zip`;
writeFileSync(join(output, zipName), zipSync(entries, { level: 9 }));
const artifacts = [packed.filename, zipName];
writeFileSync(join(output, 'SHA256SUMS'), artifacts.map(file => `${createHash('sha256').update(readFileSync(join(output, file))).digest('hex')}  ${file}`).join('\n') + '\n');
console.log(`Release artifacts: ${artifacts.join(', ')}, SHA256SUMS`);
