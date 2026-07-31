'use client';

import { useEffect } from 'react';

/**
 * Registers the offline service worker. Skipped in development, where a stale
 * cache would shadow every edit.
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
