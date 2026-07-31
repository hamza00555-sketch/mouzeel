/*
 * End-to-end check for the editor pipeline.
 *
 * Inference itself needs WebGPU, which headless Chromium does not provide, so
 * the run stubs /api/remove-background with a known matte and exercises
 * everything downstream: matte extraction, refinement, brush edits, undo,
 * compositing and export. Fixtures are generated in-browser so the repo carries
 * no binary test assets.
 *
 *   npm run dev          # in another shell
 *   node tests/e2e.mjs
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.SHOT_DIR ?? '.e2e';

let failures = 0;
function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

/** Builds a source photo and its matching cutout, so no fixture files are needed. */
const fixtures = await page.evaluate(async () => {
  const W = 800;
  const H = 600;

  const draw = (transparent) => {
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext('2d');

    if (!transparent) {
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(0, 0, W, H);
    }

    // "Subject": an ellipse plus a bar, so trimming and brushing have something
    // with a well-defined silhouette to work against.
    ctx.fillStyle = '#e0a44c';
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, 160, 210, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(W / 2 - 40, H / 2, 80, 260);

    return canvas.convertToBlob({ type: 'image/png' });
  };

  const toBase64 = async (blob) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });

  return {
    source: await toBase64(await draw(false)),
    cutout: await toBase64(await draw(true)),
  };
});

const cutoutBytes = Buffer.from(fixtures.cutout, 'base64');

await page.route('**/api/remove-background', (route) =>
  route.request().method() === 'GET'
    ? route.fulfill({ json: { available: true, hourlyLimit: 10, turnstile: false } })
    : route.fulfill({ contentType: 'image/png', body: cutoutBytes }),
);

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

// ── landing ────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/ar`, { waitUntil: 'networkidle' });
check('Arabic renders RTL', (await page.evaluate(() => document.documentElement.dir)) === 'rtl');
check('h1 is present', (await page.locator('h1').count()) === 1);
await shot('01-landing-ar');

await page.setViewportSize({ width: 390, height: 844 });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check('no horizontal overflow on mobile', overflow === 0, `${overflow}px`);
await page.setViewportSize({ width: 1440, height: 1000 });

// ── upload ─────────────────────────────────────────────────────────────────
await page.setInputFiles('input[type=file]', {
  name: 'fixture.png',
  mimeType: 'image/png',
  buffer: Buffer.from(fixtures.source, 'base64'),
});
await page.waitForSelector('[role=tablist]', { timeout: 30_000 });
check('editor opens after processing', true);
check('hero is hidden in the editor', (await page.locator('h1').count()) === 0);
await page.waitForTimeout(500);
await shot('02-editor');

// ── transparent export keeps the source dimensions and its alpha ────────────
const transparent = await Promise.all([
  page.waitForEvent('download', { timeout: 30_000 }),
  page.getByRole('button', { name: /تنزيل|Download/ }).click(),
]).then(([d]) => d);
await transparent.saveAs(`${OUT}/export-transparent.png`);

const stats = await page.evaluate(async (base64) => {
  const bitmap = await createImageBitmap(
    await (await fetch(`data:image/png;base64,${base64}`)).blob(),
  );
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

  let clear = 0;
  let solid = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 8) clear++;
    else if (data[i] > 247) solid++;
  }

  return { width: bitmap.width, height: bitmap.height, clear, solid, total: data.length / 4 };
}, (await transparent.createReadStream().then(streamToBuffer)).toString('base64'));

check('export keeps original dimensions', stats.width === 800 && stats.height === 600,
  `${stats.width}x${stats.height}`);
check('export has transparent background', stats.clear / stats.total > 0.5,
  `${((stats.clear / stats.total) * 100).toFixed(1)}% clear`);
check('export keeps the subject opaque', stats.solid / stats.total > 0.1,
  `${((stats.solid / stats.total) * 100).toFixed(1)}% opaque`);

// ── background and shadow ──────────────────────────────────────────────────
await page.getByRole('radio', { name: /^لون$|^Color$/ }).click();
await page.locator('button[aria-label="#0ea5e9"]').click();
await page.getByRole('switch').first().click();
await page.waitForTimeout(400);
await shot('03-editor-background');

// ── brush and undo ─────────────────────────────────────────────────────────
await page.getByRole('tab', { name: /الفرشاة|Brush/ }).click();
await page.getByRole('radio', { name: /^مسح$|^Erase$/ }).click();

const box = await page.locator('canvas').first().boundingBox();
await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.35);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(300);

const undoButton = page.getByRole('button', { name: /تراجع|Undo/ });
check('undo becomes available after a stroke', await undoButton.isEnabled());
await undoButton.click();
await page.waitForTimeout(300);
check('undo empties the history', !(await undoButton.isEnabled()));
await shot('04-editor-after-undo');

// ── graceful failure when neither engine is available ──────────────────────
await page.unroute('**/api/remove-background');
await page.route('**/api/remove-background', (route) => route.fulfill({ json: { available: false } }));
await page.goto(`${BASE}/ar`, { waitUntil: 'networkidle' });
await page.setInputFiles('input[type=file]', {
  name: 'fixture.png',
  mimeType: 'image/png',
  buffer: Buffer.from(fixtures.source, 'base64'),
});
await page.waitForSelector('[role=alert], .border-red-500\\/30', { timeout: 15_000 }).catch(() => {});
check(
  'shows an explanation when no engine can run',
  await page.locator('.border-red-500\\/30').isVisible().catch(() => false),
);
await shot('05-no-engine');

check('no console errors', consoleErrors.length === 0, consoleErrors[0] ?? '');

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
