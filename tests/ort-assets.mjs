/*
 * Guards two bugs that both reached production.
 *
 * 1. The copy list was hand-picked and did not match what the bundle actually
 *    loads, so the engine fetched a 404 for the one loader it needed.
 * 2. `/ort/*` is served `immutable` for a year — including 404s — so a missing
 *    file poisoned visitors' caches. The path now carries the ORT version, and
 *    the worker must point at that exact prefix.
 *
 * Runs in CI and before the e2e suite — no browser, no server, no network.
 *
 *   node tests/ort-assets.mjs
 */
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ortPublicPath, ortVersion, resolveOrtAssets } from '../scripts/copy-ort-assets.mjs';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const { assets } = await resolveOrtAssets();
check('bundle references at least one wasm loader', assets.length > 0, assets.join(', '));

for (const asset of assets) {
  const served = path.resolve('public/ort', ortVersion, asset);
  const present = await access(served).then(
    () => true,
    () => false,
  );
  check(`public${ortPublicPath}${asset} exists`, present, present ? '' : 'run npm install');
}

// The worker's wasmPaths comes from next.config's env; both must agree on the
// versioned prefix or every asset 404s under an immutable header.
const worker = await readFile('src/lib/bg/worker.ts', 'utf8');
check(
  'worker reads wasmPaths from NEXT_PUBLIC_ORT_PATH',
  /wasmPaths\s*=\s*process\.env\.NEXT_PUBLIC_ORT_PATH/.test(worker),
);

const config = await readFile('next.config.ts', 'utf8');
check(
  'next.config publishes the versioned path',
  /NEXT_PUBLIC_ORT_PATH:\s*`\/ort\/\$\{ortVersion\}\/`/.test(config),
);

console.log(
  failures ? `\n${failures} check(s) failed` : `\nORT assets are consistent (v${ortVersion})`,
);
process.exit(failures ? 1 : 0);
