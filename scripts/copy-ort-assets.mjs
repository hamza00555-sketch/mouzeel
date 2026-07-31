/**
 * Copies the ONNX Runtime Web WASM binaries into public/ort/<version> so the
 * worker can load them from our own origin. Self-hosting (instead of a CDN) is
 * what makes the offline PWA path possible and keeps us off third-party
 * availability.
 *
 * Two lessons are baked in here:
 *
 * 1. The file list is read out of the bundle we actually import rather than
 *    hand-picked. Hand-picking shipped a build that fetched a 404 for
 *    `ort-wasm-simd-threaded.asyncify.mjs` — ORT chooses its loader internally
 *    and that choice moves between releases.
 * 2. The output directory carries the ORT version. `/ort/*` is served
 *    `immutable`, and a 404 under that prefix gets the same header — so one
 *    missing file poisons every visitor's browser cache for a year, with
 *    `immutable` telling it not to revalidate even on reload. A versioned path
 *    makes the header honest and makes any such mistake self-healing.
 */
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

export const ortVersion = JSON.parse(
  await readFile(path.resolve('node_modules/onnxruntime-web/package.json'), 'utf8'),
).version;

/** Public URL prefix the worker must point `wasmPaths` at. */
export const ortPublicPath = `/ort/${ortVersion}/`;

/** Loaders referenced by the bundle, plus the .wasm sibling each one pulls in. */
export async function resolveOrtAssets() {
  // Must match the import in src/lib/bg/worker.ts.
  const bundle = require.resolve('onnxruntime-web/webgpu');
  const source = await readFile(bundle, 'utf8');
  const loaders = [...new Set(source.match(/ort-wasm-simd-threaded[a-z.]*\.mjs/g) ?? [])];

  if (loaders.length === 0) {
    throw new Error(
      `[ort] found no wasm loader references in ${path.basename(bundle)} — ` +
        'the bundle layout changed and this script needs updating',
    );
  }

  return {
    distDir: path.dirname(bundle),
    assets: loaders.flatMap((loader) => [loader, loader.replace(/\.mjs$/, '.wasm')]),
  };
}

// Importing this module (from the test) must not perform the copy.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { distDir, assets } = await resolveOrtAssets();
  const outDir = path.resolve('public/ort', ortVersion);
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
    `[ort] ${copied ? `copied ${copied}/${assets.length}` : `${assets.length} up to date`} ` +
      `→ public/ort/${ortVersion} (${mb} MB): ${assets.join(', ')}`,
  );
}
