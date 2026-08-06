import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ort from 'onnxruntime-node';
import sharp from 'sharp';

/**
 * Server-side background segmentation.
 *
 * ── Why U²-Net and not BiRefNet ─────────────────────────────────────────────
 * BiRefNet_lite is the better model on paper, and it is what this project used
 * while inference ran in the browser. On a CPU it is unusable: measured here at
 * 1024², it peaked at 6.7–12 GB of RSS and took 9–60 s per image. No free
 * serverless tier comes close to that.
 *
 * U²-Net runs at 320² and measured 520 MB / ~1 s in this exact runtime, while
 * producing a near-identical matte (73.4% confidently transparent vs 73.9%,
 * 25.1% confidently opaque in both). Apache-2.0, so commercially clean — unlike
 * the RMBG family, which is CC BY-NC.
 *
 * Contract: RGB image in, single-channel 8-bit alpha matte out at 320², which
 * the caller scales back to the source resolution.
 */
const MODEL_URL =
  process.env.SEGMENTER_MODEL_URL ??
  'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx';

/** Guards against a truncated download or a captive portal being cached as weights. */
const MIN_MODEL_BYTES = 150_000_000;

export const INPUT_SIZE = 320;

const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

function cachePath() {
  // Keyed by URL so pointing SEGMENTER_MODEL_URL elsewhere can't read a stale file.
  const key = createHash('sha256').update(MODEL_URL).digest('hex').slice(0, 16);
  return path.join(tmpdir(), 'muzeel-models', `${key}.onnx`);
}

async function loadModelBytes(): Promise<Buffer> {
  const file = cachePath();

  const cached = await readFile(file).catch(() => null);
  if (cached && cached.byteLength >= MIN_MODEL_BYTES && cached[0] === 0x08) return cached;

  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`model download failed: ${response.status}`);

  const bytes = Buffer.from(await response.arrayBuffer());
  // ONNX is protobuf: field 1 (ir_version), wire type 0 — byte 0 is always 0x08.
  if (bytes.byteLength < MIN_MODEL_BYTES || bytes[0] !== 0x08) {
    throw new Error(`downloaded ${bytes.byteLength} bytes but they are not an ONNX model`);
  }

  // Write via a temp name so a killed instance can't leave a half file behind
  // for the next one to load.
  await mkdir(path.dirname(file), { recursive: true }).catch(() => {});
  const staging = `${file}.${process.pid}.part`;
  await writeFile(staging, bytes);
  await rename(staging, file).catch(() => {});

  return bytes;
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;

/**
 * Built once per instance and reused across warm invocations — creation costs
 * ~1.3 s, which would otherwise be paid on every request.
 */
function getSession() {
  sessionPromise ??= (async () => {
    const bytes = await loadModelBytes();

    return ort.InferenceSession.create(bytes, {
      executionProviders: ['cpu'],
      // Two threads halved the measured latency at no memory cost; the arena
      // is off because it tripled peak RSS for a marginal speedup.
      intraOpNumThreads: 2,
      enableCpuMemArena: false,
      graphOptimizationLevel: 'all',
      logSeverityLevel: 3,
    });
  })().catch((error) => {
    sessionPromise = null; // let the next request retry
    throw error;
  });

  return sessionPromise;
}

/** Downloads and compiles ahead of the first request. Failures are the caller's to see. */
export function warmUp() {
  return getSession();
}

/**
 * Returns an `INPUT_SIZE`² 8-bit alpha matte. The caller owns resizing it back
 * up and compositing — that already happens in the browser editor.
 */
export async function segment(image: Buffer): Promise<Uint8Array> {
  const session = await getSession();

  const pixels = await sharp(image)
    .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const plane = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(plane * 3);
  for (let i = 0; i < plane; i++) {
    input[i] = (pixels[i * 3] / 255 - MEAN[0]) / STD[0];
    input[plane + i] = (pixels[i * 3 + 1] / 255 - MEAN[1]) / STD[1];
    input[plane * 2 + i] = (pixels[i * 3 + 2] / 255 - MEAN[2]) / STD[2];
  }

  const outputs = await session.run({
    [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]),
  });

  // U²-Net emits seven deep-supervision maps; the first is the full-depth one.
  // They are already sigmoid-activated but not normalised, so stretch to 0..1
  // the way the reference implementation does.
  const raw = outputs[session.outputNames[0]].data as Float32Array;

  let lo = Infinity;
  let hi = -Infinity;
  for (const value of raw) {
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  }

  const span = hi - lo || 1;
  const matte = new Uint8Array(plane);
  for (let i = 0; i < plane; i++) {
    matte[i] = ((raw[i] - lo) / span) * 255;
  }

  return matte;
}

/**
 * Applies the matte to the source at its original resolution and encodes a PNG
 * with alpha — the exact response shape the editor already consumes.
 */
export async function cutout(image: Buffer): Promise<Buffer> {
  const matte = await segment(image);

  // A sharp instance is a single-use pipeline: reading metadata off one and
  // then continuing to build on it silently drops the later operations.
  const { width, height } = await sharp(image).metadata();
  if (!width || !height) throw new Error('could not read image dimensions');

  // `toColourspace('b-w')` is load-bearing: resizing a 1-channel raw buffer
  // promotes it to 3 channels, and the widened buffer then makes `joinChannel`
  // drop the alpha silently rather than error.
  const grey = await sharp(Buffer.from(matte), {
    raw: { width: INPUT_SIZE, height: INPUT_SIZE, channels: 1 },
  })
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  // `dest-in` keeps the destination's colour and takes the source's alpha, so
  // the matte has to arrive as RGBA. `joinChannel` looks like the cleaner route
  // but silently yields a 3-channel PNG for a JPEG source.
  const rgbaMatte = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgbaMatte[i * 4] = 255;
    rgbaMatte[i * 4 + 1] = 255;
    rgbaMatte[i * 4 + 2] = 255;
    rgbaMatte[i * 4 + 3] = grey[i];
  }

  return sharp(image)
    .ensureAlpha()
    .composite([
      { input: rgbaMatte, raw: { width, height, channels: 4 }, blend: 'dest-in' },
    ])
    .png()
    .toBuffer();
}
