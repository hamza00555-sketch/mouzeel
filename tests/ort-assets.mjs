/*
 * Guards the class of bug that shipped a build fetching a 404 for
 * `ort-wasm-simd-threaded.asyncify.mjs`: the copy list was hand-picked and did
 * not match what the bundle actually loads.
 *
 * Runs in CI and before the e2e suite — no browser, no server, no network.
 *
 *   node tests/ort-assets.mjs
 */
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const bundle = require.resolve('onnxruntime-web/webgpu');
const source = await readFile(bundle, 'utf8');
const loaders = [...new Set(source.match(/ort-wasm-simd-threaded[a-z.]*\.mjs/g) ?? [])];

check('bundle references at least one wasm loader', loaders.length > 0, loaders.join(', '));

for (const loader of loaders) {
  for (const asset of [loader, loader.replace(/\.mjs$/, '.wasm')]) {
    const served = path.resolve('public/ort', asset);
    const present = await access(served).then(
      () => true,
      () => false,
    );
    check(`public/ort serves ${asset}`, present, present ? '' : 'missing — run npm install');
  }
}

// The worker's wasmPaths must line up with where the script writes.
const worker = await readFile('src/lib/bg/worker.ts', 'utf8');
check("worker points wasmPaths at '/ort/'", /wasmPaths\s*=\s*'\/ort\/'/.test(worker));

console.log(failures ? `\n${failures} check(s) failed` : '\nORT assets are consistent');
process.exit(failures ? 1 : 0);
