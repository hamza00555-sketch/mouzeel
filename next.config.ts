import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

// Kept in lockstep with scripts/copy-ort-assets.mjs, which writes the binaries
// to public/ort/<version>. onnxruntime-web does not expose ./package.json
// through its exports map, so read it off disk.
const ortVersion = JSON.parse(
  readFileSync('node_modules/onnxruntime-web/package.json', 'utf8'),
).version as string;

const nextConfig: NextConfig = {
  // Inlined at build time, so the Web Worker gets it too.
  env: { NEXT_PUBLIC_ORT_PATH: `/ort/${ortVersion}/` },

  // Note: we deliberately do NOT set COOP/COEP headers. Cross-origin isolation
  // would unlock multi-threaded WASM, but it also breaks embedded third-party
  // widgets (Turnstile) and cross-origin assets. The local engine runs on
  // WebGPU, which is far faster than threaded WASM anyway, so the trade is a
  // clear win — see docs in README.
  async headers() {
    return [
      {
        // Safe only because the path carries the ORT version: this header lands
        // on 404s under the prefix too, and a year of `immutable` on a missing
        // file is a cache every visitor is stuck with. Versioning means a
        // mistake is abandoned at the next bump rather than sticking.
        source: '/ort/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
