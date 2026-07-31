/**
 * Copies the ONNX Runtime Web WASM binaries into public/ort so the worker can
 * load them from our own origin. Self-hosting (instead of a CDN) is what makes
 * the offline PWA path possible and keeps us off third-party availability.
 *
 * The file list is read out of the bundle we actually import rather than
 * hand-picked. Hand-picking shipped a build that fetched a 404 for
 * `ort-wasm-simd-threaded.asyncify.mjs` — ORT chooses its loader internally and
 * that choice moves between releases, so the bundle is the only honest source
 * of truth. A missing asset fails the build here instead of failing the engine
 * in front of a user.
 */
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const outDir = path.resolve('public/ort');

// Must match the import in src/lib/bg/worker.ts.
const bundle = require.resolve('onnxruntime-web/webgpu');
const distDir = path.dirname(bundle);

const source = await readFile(bundle, 'utf8');
const loaders = [...new Set(source.match(/ort-wasm-simd-threaded[a-z.]*\.mjs/g) ?? [])];

if (loaders.length === 0) {
  throw new Error(
    `[ort] found no wasm loader references in ${path.basename(bundle)} — ` +
      'the bundle layout changed and this script needs updating',
  );
}

// Each loader pulls in the .wasm binary of the same name.
const assets = loaders.flatMap((loader) => [loader, loader.replace(/\.mjs$/, '.wasm')]);

await mkdir(outDir, { recursive: true });

let copied = 0;
let bytes = 0;

for (const name of assets) {
  const from = path.join(distDir, name);
  const to = path.join(outDir, name);

  const src = await stat(from).catch(() => null);
  if (!src) throw new Error(`[ort] ${name} is referenced by the bundle but missing from dist`);

  bytes += src.size;

  const dest = await stat(to).catch(() => null);
  if (dest && dest.size === src.size) continue;

  await copyFile(from, to);
  copied++;
}

const mb = (bytes / 1024 / 1024).toFixed(1);
console.log(
  copied
    ? `[ort] copied ${copied}/${assets.length} asset(s) to public/ort (${mb} MB): ${assets.join(', ')}`
    : `[ort] ${assets.length} asset(s) already up to date (${mb} MB)`,
);
