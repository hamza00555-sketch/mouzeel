'use client';

import { useEffect } from 'react';
import { runWhenIdle } from '@/lib/editor-activity';

/** Set once per tab so a misbehaving worker can't put us in a reload loop. */
const RELOAD_FLAG = 'muzeel:sw-reloaded';

/**
 * Registers the offline service worker. Skipped in development, where a stale
 * cache would shadow every edit.
 *
 * Also handles the takeover case: when a new worker activates, this page is
 * already running whatever code the old one served, so it needs one reload to
 * pick up the fresh build. That is the escape hatch for anyone whose cache the
 * v1 worker poisoned — without it a corrected worker still leaves the page in
 * front of them running the broken code.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    // A *takeover* means this page was already controlled by an older worker,
    // so the code it is running came from that worker. First-ever registration
    // also fires controllerchange, and reloading then would give every new
    // visitor a pointless flash — so only pages that were already controlled
    // qualify.
    const wasControlled = Boolean(navigator.serviceWorker.controller);

    const reloadIfSafe = () => {
      if (!wasControlled) return;
      if (sessionStorage.getItem(RELOAD_FLAG)) return;

      // Deferred, never dropped: reloading during an upload wipes work the user
      // is waiting on, but a browser holding a poisoned cache still needs the
      // reload — so it waits for the dropzone to be empty again.
      runWhenIdle(() => {
        if (sessionStorage.getItem(RELOAD_FLAG)) return;
        sessionStorage.setItem(RELOAD_FLAG, '1');
        location.reload();
      });
    };

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'muzeel:activated') reloadIfSafe();
    };

    const onControllerChange = () => {
      if (navigator.serviceWorker.controller) reloadIfSafe();
    };

    const register = () => {
      navigator.serviceWorker.addEventListener('message', onMessage);
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
    };

    // Wait for load so registration never competes with the first paint.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
