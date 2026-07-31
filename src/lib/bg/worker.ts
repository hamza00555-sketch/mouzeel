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
ort.env.wasm.wasmPaths = '/ort/';
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

/** Streams the model, reporting progress, and caches it for every later visit. */
async function loadModelBytes(): Promise<ArrayBuffer> {
  const cache = await caches.open(MODEL_CACHE).catch(() => null);

  const cached = await cache?.match(MODEL_URL);
  if (cached) return cached.arrayBuffer();

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

function getSession() {
  sessionPromise ??= (async () => {
    const bytes = await loadModelBytes().catch((error) => {
      throw Object.assign(new Error('networkModel'), { code: 'networkModel' as const, cause: error });
    });

    post({ type: 'progress', phase: 'loading', ratio: null });
    return ort.InferenceSession.create(bytes, {
      executionProviders: ['webgpu'],
      graphOptimizationLevel: 'all',
    });
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
