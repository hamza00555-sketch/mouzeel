// Copies the ONNX Runtime Web WASM binaries into public/ort so the worker can
// load them from our own origin. Self-hosting (instead of a CDN) is what makes
// the offline PWA path possible and keeps us off third-party availability.
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const outDir = path.resolve('public/ort');

// jsep = the WebGPU-capable build (also runs the CPU EP); the plain build is the
// fallback for browsers without WebGPU. Each binary is its own export subpath —
// the package does not expose package.json, so resolve them individually.
const assets = [
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
];

await mkdir(outDir, { recursive: true });

let copied = 0;
for (const name of assets) {
  const from = require.resolve(`onnxruntime-web/${name}`);
  const to = path.join(outDir, name);

  const [src, dest] = await Promise.all([stat(from), stat(to).catch(() => null)]);
  if (dest && dest.size === src.size) continue;

  await copyFile(from, to);
  copied++;
}

console.log(
  copied ? `[ort] copied ${copied} asset(s) to public/ort` : '[ort] assets already up to date',
);
