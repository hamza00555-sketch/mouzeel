/*
 * Guards the service worker against the bug that pinned stale app code in
 * users' browsers across three deploys.
 *
 * v1 served /_next/static/ cache-first and never bumped its cache version, so
 * whatever chunk a browser saw first was the chunk it kept — no server-side fix
 * could reach it. Cache-first is only sound for URLs that are content-addressed
 * by construction, which here means /ort/<version>/ and nothing else.
 *
 * This is a SHAPE check, not a behavioural one: it reads the source and asserts
 * the strategy is wired the right way round. The behavioural proof — that a
 * changed chunk actually reaches the client — lives in tests/e2e.mjs.
 *
 *   node tests/sw-cache.mjs
 */
import { readFile } from 'node:fs/promises';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const sw = await readFile('public/sw.js', 'utf8');

// Strip comments so prose about the old strategy can't satisfy or trip a check.
const code = sw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const version = code.match(/const VERSION = '([^']+)'/)?.[1];
check('sw declares a cache VERSION', Boolean(version), version ?? 'not found');
check(
  'cache version moved past the poisoned v1',
  version !== undefined && version !== 'v1',
  version ?? '',
);

check(
  'activate evicts every non-current muzeel cache',
  /caches\s*\n?\s*\.keys\(\)/.test(code) && /caches\.delete\(key\)/.test(code),
);
check(
  'activate still spares the 114 MB model cache',
  /startsWith\('muzeel-model-'\)/.test(code),
);

// The two strategies must be split, and split the right way round.
const immutable = code.match(/function isImmutableAsset[\s\S]*?\n}/)?.[0] ?? '';
const revalidated = code.match(/function isRevalidatedAsset[\s\S]*?\n}/)?.[0] ?? '';

check(
  'only version-stamped /ort/ is treated as immutable',
  /\/ort\\\/\\d\+\\\.\\d\+\\\.\\d\+\\\//.test(immutable) || /ort.*\\d\+/.test(immutable),
  immutable.trim().split('\n')[1]?.trim() ?? 'missing',
);
check(
  'immutable set excludes app code',
  !immutable.includes('_next/static'),
);
check(
  'app code is in the revalidated set',
  revalidated.includes('_next/static'),
);

// The heart of it: the revalidated branch must fetch unconditionally, not only
// when the cache misses. `hit ?? fetch(...)` is exactly the v1 bug.
const revalidateBranch =
  code.match(/if \(isRevalidatedAsset\(url\)\) \{[\s\S]*?\n  \}/)?.[0] ?? '';

check('a revalidated branch exists', revalidateBranch.length > 0);
check(
  'revalidated assets refetch even on a cache hit',
  /const fresh = fetch\(request\)/.test(revalidateBranch) &&
    /return hit \?\? fresh/.test(revalidateBranch),
  'must not be `hit ?? fetch(...)`',
);
check(
  'revalidated branch never short-circuits the network on a hit',
  !/hit \?\? fetch\(/.test(revalidateBranch),
);

// Pages must keep coming from the network first, or a deploy never lands.
check(
  'navigations stay network-first',
  /request\.mode === 'navigate'[\s\S]*?fetch\(request\)\s*\n?\s*\.then/.test(code),
);

// Clients need to be told, or the open page keeps running the old build.
check(
  'activation notifies open pages',
  /postMessage\(\{ type: 'muzeel:activated'/.test(code),
);

const hook = await readFile('src/components/ServiceWorker.tsx', 'utf8');
check(
  'client reloads on takeover',
  /controllerchange/.test(hook) && /location\.reload\(\)/.test(hook),
);
check(
  'reload is suppressed while an image is open',
  /isEditing\(\)/.test(hook),
);
check('reload is loop-guarded', /sessionStorage/.test(hook));

console.log(
  failures ? `\n${failures} check(s) failed` : `\nservice worker caching is sound (${version})`,
);
process.exit(failures ? 1 : 0);
