import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync('src/version.ts', `export const VERSION = ${JSON.stringify(packageJson.version)};\n`);
const tsc = resolve('node_modules/typescript/bin/tsc');
execFileSync(process.execPath, [tsc, '--noEmit'], { stdio: 'inherit' });
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
const result = await build({
  entryPoints: ['src/cli.ts', 'src/mcp-server.ts', 'src/login-worker.ts'],
  outdir: 'dist', bundle: true, platform: 'node', format: 'esm', target: 'node22',
  sourcemap: false, metafile: true, legalComments: 'eof',
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
});
for (const file of ['cli.js', 'mcp-server.js', 'login-worker.js']) chmodSync(join('dist', file), 0o755);
// Preserve redistribution notices for all third-party modules included in the bundle.
const notices = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes('node_modules/')) continue;
  let directory = dirname(resolve(input));
  while (directory !== dirname(directory) && !existsSync(join(directory, 'package.json'))) directory = dirname(directory);
  if (!existsSync(join(directory, 'package.json'))) continue;
  const metadata = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  const key = `${metadata.name}@${metadata.version}`;
  if (notices.has(key)) continue;
  const license = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'LICENCE', 'LICENSE-MIT', 'LICENSE-MIT.txt'].find(file => existsSync(join(directory, file)));
  notices.set(key, `${key} (${metadata.license || 'see upstream'})\n${license ? readFileSync(join(directory, license), 'utf8') : `Source: ${typeof metadata.repository === 'string' ? metadata.repository : metadata.repository?.url || metadata.homepage || key}`}`);
}
writeFileSync('dist/THIRD_PARTY_NOTICES.txt', [...notices.values()].join('\n\n----------------------------------------\n\n') + '\n');
console.log(`Built ${packageJson.version}: standalone CLI, MCP server, login helper, and ${notices.size} dependency notices.`);
