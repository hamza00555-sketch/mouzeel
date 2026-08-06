'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js — which is now a tombstone that deletes the old caches and
 * unregisters itself.
 *
 * This looks pointless and is not: an earlier build installed a worker that
 * pinned app code forever, and the only way to reach those browsers is to hand
 * them a new worker that removes itself. Registration has to stay until it is
 * safe to assume no poisoned worker is still out there.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    const register = () => void navigator.serviceWorker.register('/sw.js').catch(() => {});

    // Wait for load so registration never competes with the first paint.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
