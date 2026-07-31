/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/webgpu';
import {
  IMAGENET_MEAN,
  IMAGENET_STD,
  INPUT_NAME,
  INPUT_SIZE,
  MODEL_BYTES,
  MODEL_CACHE,
  MODEL_URL,
  OUTPUT_NAME,
} from './constants';
import type { ErrorCode, WorkerRequest, WorkerResponse } from './types';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

// Self-hosted binaries (see scripts/copy-ort-assets.mjs). Single-threaded: we
// don't set COOP/COEP, so SharedArrayBuffer is unavailable — irrelevant here
// because inference runs on WebGPU.
// Version-stamped by next.config from the installed onnxruntime-web, so the
// `immutable` cache header on /ort/* is truthful and a bad deploy can't leave a
// year-long 404 cached in visitors' browsers.
ort.env.wasm.wasmPaths = process.env.NEXT_PUBLIC_ORT_PATH ?? '/ort/';
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;


function post(message: WorkerResponse, transfer: Transferable[] = []) {
  ctx.postMessage(message, transfer);
}

function fail(code: ErrorCode, error: unknown, id?: number) {
  post({ type: 'error', id, code, message: error instanceof Error ? error.message : String(error) });
}

/** Give up if the download makes no progress for this long. */
const STALL_TIMEOUT_MS = 30_000;

/**
 * A truncated download or a captive-portal HTML page will cache just as happily
 * as the real weights, and then every retry fails identically at session
 * creation. ONNX is protobuf: field 1 (ir_version), wire type 0 — so byte 0 is
 * always 0x08. Combined with a size floor that is enough to reject the junk.
 */
function looksLikeOnnx(bytes: Uint8Array) {
  return bytes.byteLength > MODEL_BYTES * 0.9 && bytes[0] === 0x08;
}

async function evictCachedModel() {
  await caches
    .open(MODEL_CACHE)
    .then((cache) => cache.delete(MODEL_URL))
    .catch(() => {});
}

/** Streams the model, reporting progress, and caches it for every later visit. */
async function loadModelBytes(): Promise<ArrayBuffer> {
  const cache = await caches.open(MODEL_CACHE).catch(() => null);

  const cached = await cache?.match(MODEL_URL);
  if (cached) {
    const bytes = new Uint8Array(await cached.arrayBuffer());
    if (looksLikeOnnx(bytes)) return bytes.buffer as ArrayBuffer;
    await evictCachedModel(); // poisoned entry — fall through and refetch
  }

  // Without this a blocked or half-open connection leaves the user staring at a
  // progress bar forever, with no error and no chance to fall back.
  const controller = new AbortController();
  let stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
  const resetStallTimer = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
  };

  try {
    const response = await fetch(MODEL_URL, { signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`model fetch failed: ${response.status}`);
    }

    const declared = Number(response.headers.get('content-length')) || MODEL_BYTES;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      resetStallTimer();
      chunks.push(value);
      received += value.byteLength;
      post({ type: 'progress', phase: 'downloading', ratio: Math.min(received / declared, 1) });
    }

    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    if (!looksLikeOnnx(bytes)) {
      throw new Error(
        `downloaded ${received} bytes but they are not an ONNX model — the connection may be intercepted`,
      );
    }

    // Cache failures (quota, private mode) only cost us the next download.
    await cache
      ?.put(
        MODEL_URL,
        new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }),
      )
      .catch(() => {});

    return bytes.buffer as ArrayBuffer;
  } finally {
    clearTimeout(stallTimer);
  }
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;

/**
 * An adapter existing does not mean a session will build on it: driver
 * blocklists, missing shader features and out-of-memory all surface only at
 * `create()`. Falling back to the CPU kernel is slow but finishes, which beats
 * a dead end — and if both fail we keep the real reason from each attempt so
 * the UI can show something more useful than "it didn't work".
 */
async function createSession(bytes: ArrayBuffer) {
  const failures: string[] = [];

  for (const provider of ['webgpu', 'wasm'] as const) {
    try {
      const session = await ort.InferenceSession.create(bytes, {
        executionProviders: [provider],
        graphOptimizationLevel: 'all',
      });

      post({ type: 'engine', provider });
      return session;
    } catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ORT names the exact URL it could not load, so don't second-guess it with a
  // hardcoded filename — which variant it wants is its own internal choice.
  // Just say what to do about it when the failure is clearly a missing asset.
  const combined = failures.join(' | ');
  const missingAsset = combined.includes(ort.env.wasm.wasmPaths as string);

  throw Object.assign(
    new Error(
      missingAsset
        ? `${combined} — run "npm install" to regenerate public/ort, then redeploy`
        : combined,
    ),
    { code: 'engineFailed' as const },
  );
}

function getSession() {
  sessionPromise ??= (async () => {
    const bytes = await loadModelBytes().catch((error) => {
      throw Object.assign(new Error(error instanceof Error ? error.message : String(error)), {
        code: 'networkModel' as const,
      });
    });

    post({ type: 'progress', phase: 'loading', ratio: null });

    try {
      return await createSession(bytes);
    } catch (error) {
      // The bytes passed the header check yet still would not parse or build:
      // drop them so a retry starts from a fresh download rather than replaying
      // the same failure forever.
      await evictCachedModel();
      throw error;
    }
  })().catch((error) => {
    sessionPromise = null; // let the user retry
    throw error;
  });

  return sessionPromise;
}

/** Resize to 1024², then normalise into an NCHW float32 tensor. */
function toTensor(bitmap: ImageBitmap): ort.Tensor {
  const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2d context unavailable');

  context.drawImage(bitmap, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const { data } = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const plane = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(plane * 3);

  for (let i = 0; i < plane; i++) {
    const p = i * 4;
    tensor[i] = (data[p] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    tensor[plane + i] = (data[p + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    tensor[plane * 2 + i] = (data[p + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }

  return new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

/**
 * The exported graph ends on a Conv with no activation, so the output is raw
 * logits — squash them before treating the values as alpha.
 */
function toMaskBitmap(logits: Float32Array): Promise<ImageBitmap> {
  const plane = INPUT_SIZE * INPUT_SIZE;
  const pixels = new Uint8ClampedArray(plane * 4);

  for (let i = 0; i < plane; i++) {
    const p = i * 4;
    pixels[p] = 255;
    pixels[p + 1] = 255;
    pixels[p + 2] = 255;
    // Alpha carries the matte, so the bitmap can mask directly via destination-in.
    pixels[p + 3] = (1 / (1 + Math.exp(-logits[i]))) * 255;
  }

  return createImageBitmap(new ImageData(pixels, INPUT_SIZE, INPUT_SIZE));
}

async function run(id: number, bitmap: ImageBitmap) {
  const session = await getSession();

  post({ type: 'progress', phase: 'processing', ratio: null });
  const outputs = await session.run({ [INPUT_NAME]: toTensor(bitmap) });
  bitmap.close();

  const logits = outputs[OUTPUT_NAME].data as Float32Array;
  const mask = await toMaskBitmap(logits);

  post({ type: 'result', id, mask }, [mask]);
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'warmup') {
      await getSession();
      post({ type: 'ready' });
      return;
    }

    await run(request.id, request.bitmap);
  } catch (error) {
    const code = (error as { code?: ErrorCode }).code ?? 'engineFailed';
    fail(code, error, request.type === 'run' ? request.id : undefined);
  }
};
