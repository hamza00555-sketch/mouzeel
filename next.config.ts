import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Note: we deliberately do NOT set COOP/COEP headers. Cross-origin isolation
  // would unlock multi-threaded WASM, but it also breaks embedded third-party
  // widgets (Turnstile) and cross-origin assets. The local engine runs on
  // WebGPU, which is far faster than threaded WASM anyway, so the trade is a
  // clear win — see docs in README.
  async headers() {
    return [
      {
        // The ORT WASM binaries are content-addressed by version; safe to pin.
        source: '/ort/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
