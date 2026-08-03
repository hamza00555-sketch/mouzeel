/*
 * Behavioural proof for the service-worker cache fix.
 *
 * The static guard (tests/sw-cache.mjs) only reads the source. This drives a
 * real browser against a real production build and reproduces the incident that
 * left users pinned to stale app code:
 *
 *   1. A cache left over from the broken v1 worker is evicted on activation.
 *   2. A /_next/static/ asset whose bytes change on the server actually reaches
 *      the client on the next load — the thing cache-first made impossible.
 *
 * Kept out of tests/e2e.mjs on purpose: a live service worker intercepting
 * requests would make the editor suite non-deterministic.
 *
 *   npm run build && npm start      # in another shell
 *   node tests/sw-behaviour.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});

/** Waits until a service worker is actually controlling the page. */
const waitForControl = (page) =>
  page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, {
    timeout: 30_000,
  });

// ── 1. a poisoned v1 cache is evicted ───────────────────────────────────────
{
  const context = await browser.newContext();
  const page = await context.newPage();

  // Land on the page first so we can reach the Cache API on this origin, then
  // plant exactly what the broken worker would have left behind.
  await page.goto(`${BASE}/ar`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const cache = await caches.open('muzeel-assets-v1');
    await cache.put('/_next/static/stale.js', new Response('// pinned by v1'));
  });

  const before = await page.evaluate(() => caches.keys());
  check('a v1 asset cache is present to begin with', before.includes('muzeel-assets-v1'));

  await page.reload({ waitUntil: 'load' });
  await waitForControl(page).catch(() => {});
  // Activation runs eviction asynchronously; give it a moment to land.
  await page
    .waitForFunction(
      async () => !(await caches.keys()).includes('muzeel-assets-v1'),
      null,
      { timeout: 20_000 },
    )
    .catch(() => {});

  const after = await page.evaluate(() => caches.keys());
  check('v1 cache is evicted once the new worker activates', !after.includes('muzeel-assets-v1'),
    after.join(', ') || 'no caches');
  // The model cache is the one thing eviction must never touch: re-downloading
  // 114 MB because a chunk changed would be indefensible.
  check('the model cache survives the version bump', after.includes('muzeel-model-v1'),
    after.join(', ') || 'no caches');

  await context.close();
}

// ── 2. changed app code reaches the client ──────────────────────────────────
{
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE}/ar`, { waitUntil: 'load' });
  await waitForControl(page).catch(() => {});

  // Pick a real chunk the page loaded, so we exercise the exact path that broke.
  const chunk = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => new URL(entry.name).pathname)
      .find((path) => path.startsWith('/_next/static/') && path.endsWith('.js')),
  );
  check('found a /_next/static/ chunk to test with', Boolean(chunk), chunk ?? 'none');

  if (chunk) {
    // Prime the cache through the service worker.
    const first = await page.evaluate(
      (path) => fetch(path).then((response) => response.text()),
      chunk,
    );
    check('chunk is served', first.length > 0, `${first.length} bytes`);

    // The asset cache is created lazily on the first store, so this is the
    // earliest honest place to assert the current version is the one in use.
    const keys = await page.evaluate(() => caches.keys());
    check('assets land in the current-version cache', keys.includes('muzeel-assets-v2'),
      keys.join(', ') || 'no caches');

    // Now the server starts returning different bytes for the same URL — the
    // shape of a redeploy that reuses a chunk name.
    await context.route(`**${chunk}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '/* redeployed */',
      }),
    );

    // First read after the change may still be the cached copy — that is what
    // stale-while-revalidate means — but the refetch must update the entry.
    await page.evaluate((path) => fetch(path).then((r) => r.text()), chunk);
    await page.waitForTimeout(1200);

    const second = await page.evaluate(
      (path) => fetch(path).then((response) => response.text()),
      chunk,
    );
    check(
      'a changed chunk reaches the client within one extra load',
      second.includes('redeployed'),
      second.includes('redeployed') ? '' : 'still serving the pinned copy',
    );

    const cached = await page.evaluate(async (path) => {
      const hit = await caches.match(path);
      return hit ? hit.text() : '';
    }, chunk);
    check('the cache entry itself was replaced', cached.includes('redeployed'),
      cached.includes('redeployed') ? '' : 'cache still holds the old bytes');
  }

  await context.close();
}

// ── 3. a takeover must not wipe work in flight ──────────────────────────────
// The first cut of the reload guard only counted the *ready* state, so a worker
// activating mid-upload reloaded the page and dropped the user back to an empty
// dropzone as if they had never picked a file.
{
  const context = await browser.newContext();
  const page = await context.newPage();

  // Hold the request open so the app stays in its processing state.
  await context.route('**/api/remove-background', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { available: true, hourlyLimit: 10, turnstile: false } });
    }
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    return route.abort();
  });

  await page.goto(`${BASE}/ar`, { waitUntil: 'load' });
  await waitForControl(page).catch(() => {});

  // Reload so the page starts life already controlled. Only such a page is
  // eligible for a takeover reload — without this the hook bails out early and
  // the test would pass no matter how broken the guard is.
  await page.reload({ waitUntil: 'load' });
  await waitForControl(page).catch(() => {});

  // Sentinel: survives only if the page does not navigate.
  await page.evaluate(() => {
    window.__stillHere = true;
    sessionStorage.removeItem('muzeel:sw-reloaded');
  });

  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  check('page is under worker control before the takeover', controlled);

  const png = Buffer.from(
    await page.evaluate(async () => {
      const canvas = new OffscreenCanvas(240, 240);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(0, 0, 240, 240);
      const blob = await canvas.convertToBlob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
    }),
    'base64',
  );

  await page.setInputFiles('input[type=file]', {
    name: 'busy.png',
    mimeType: 'image/png',
    buffer: png,
  });

  const busy = await page
    .locator('[role=progressbar]')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  check('upload is in flight', busy);

  // Fire the exact signal a newly activated worker sends.
  await page.evaluate(() =>
    navigator.serviceWorker.dispatchEvent(
      new MessageEvent('message', { data: { type: 'muzeel:activated', version: 'v3' } }),
    ),
  );
  await page.waitForTimeout(1500);

  const survived = await page.evaluate(() => window.__stillHere === true);
  check('a worker takeover does not reload away an upload', survived,
    survived ? '' : 'the page reloaded and the upload was lost');
  check(
    'the progress UI is still on screen',
    await page.locator('[role=progressbar]').first().isVisible().catch(() => false),
  );

  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nservice worker behaviour is correct');
process.exit(failures ? 1 : 0);
