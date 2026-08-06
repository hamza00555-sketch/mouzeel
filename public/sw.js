/*
 * Tombstone.
 *
 * Muzeel used to ship an offline service worker that cached app code
 * cache-first and never bumped its cache version. Browsers that visited during
 * that period pinned whatever build they saw first and stopped asking the
 * server — three separate deploys never reached them, because the bug had
 * disabled its own delivery channel.
 *
 * Deleting this file would NOT have fixed that: an installed worker keeps
 * running and keeps serving its cache regardless of whether the file still
 * exists. The only way out is to ship a worker whose job is to remove itself.
 *
 * So this one intercepts nothing, deletes every cache the old versions created,
 * unregisters itself, and asks open pages to reload once onto the real network.
 * After that the site has no service worker at all — inference happens on the
 * server now, so there is nothing left worth caching offline.
 *
 * Do not "restore" caching here. If offline support is ever wanted again it
 * needs versioned cache names and a revalidating strategy, not this file.
 */

self.addEventListener('install', () => {
  // Take over immediately rather than waiting for every old tab to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('muzeel-')).map((key) => caches.delete(key)));

      // Stop controlling any page, now and for future loads.
      await self.registration.unregister();

      // Pages loaded under the old worker are still running its cached code, so
      // they need one reload to reach the current build.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) client.navigate(client.url).catch(() => {});
    })(),
  );
});

// No fetch handler on purpose: every request goes straight to the network.
