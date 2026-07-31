/*
 * Offline support for Muzeel.
 *
 * The 114 MB model is cached separately by the inference worker (Cache API,
 * `muzeel-model-v1`); this only has to keep the app shell and the ONNX Runtime
 * binaries available so the whole tool still opens with no connection.
 */
const VERSION = 'v1';
const SHELL = `muzeel-shell-${VERSION}`;
const ASSETS = `muzeel-assets-${VERSION}`;

const SHELL_URLS = ['/ar', '/en'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Best-effort: a failed precache must not block activation.
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('muzeel-') && key !== SHELL && key !== ASSETS)
            // Leave the model cache alone — re-downloading it would be brutal.
            .filter((key) => !key.startsWith('muzeel-model-'))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith('/ort/') ||
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:woff2?|png|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache the processing endpoint: it is one-shot and user-specific.
  if (url.pathname.startsWith('/api/')) return;

  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === 'navigate') {
    // Network-first so deploys land immediately; the cache is the offline net.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(SHELL).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match('/ar'))),
    );
  }
});
