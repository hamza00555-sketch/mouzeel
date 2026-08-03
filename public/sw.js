/*
 * Offline support for Muzeel.
 *
 * The 114 MB model is cached separately by the inference worker (Cache API,
 * `muzeel-model-v1`); this only has to keep the app shell and the ONNX Runtime
 * binaries available so the whole tool still opens with no connection.
 *
 * ── Why the strategy is split ────────────────────────────────────────────────
 * v1 served everything cache-first, including /_next/static/. Cache-first is
 * only sound when a URL can never change meaning — and a chunk filename is not
 * that guarantee. The result was a browser that pinned the app code it happened
 * to see first and never asked again, so a shipped fix could not reach it. The
 * cache version had also never moved, so `activate` never evicted anything.
 *
 * Rules now:
 *   - Cache-first only for /ort/<version>/, whose URL carries the ORT version
 *     and is therefore content-addressed by construction. Revalidating 23 MB on
 *     every load would be pure waste.
 *   - Stale-while-revalidate for app code, fonts and images: answer from cache
 *     instantly, always refetch in the background. A stale copy can survive one
 *     load instead of forever.
 *
 * Bumping VERSION is what rescues browsers already holding a poisoned entry:
 * `activate` deletes every muzeel-* cache that is not current.
 */
const VERSION = 'v2';
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
      .then(() => self.clients.claim())
      // Tell open pages a new worker is in charge; they decide whether it is
      // safe to reload (see src/components/ServiceWorker.tsx).
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        for (const client of clients) client.postMessage({ type: 'muzeel:activated', version: VERSION });
      }),
  );
});

/** Version-stamped ORT binaries: the URL itself pins the bytes. */
function isImmutableAsset(url) {
  return /^\/ort\/\d+\.\d+\.\d+\//.test(url.pathname);
}

/** App code and static media: cacheable, but must never be pinned. */
function isRevalidatedAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:woff2?|png|svg|webp|ico)$/.test(url.pathname)
  );
}

function putInCache(request, response) {
  if (!response.ok) return response;
  const copy = response.clone();
  void caches.open(ASSETS).then((cache) => cache.put(request, copy));
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache the processing endpoint: it is one-shot and user-specific.
  if (url.pathname.startsWith('/api/')) return;

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then((hit) => hit ?? fetch(request).then((r) => putInCache(request, r))),
    );
    return;
  }

  if (isRevalidatedAsset(url)) {
    event.respondWith(
      caches.match(request).then((hit) => {
        // Kicked off whether or not there was a hit, so the entry is always
        // refreshed — this is the line whose absence pinned stale app code.
        const fresh = fetch(request)
          .then((response) => putInCache(request, response))
          .catch(() => hit);

        return hit ?? fresh;
      }),
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
