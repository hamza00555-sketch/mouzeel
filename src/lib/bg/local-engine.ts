import { MODEL_CACHE, MODEL_URL } from './constants';
import { MuzeelError } from './types';
import type { Progress, WorkerRequest, WorkerResponse } from './types';

let webgpuCheck: Promise<boolean> | null = null;

/**
 * `'gpu' in navigator` is not enough: headless and software-only environments
 * expose the property but hand back no adapter, and we would happily start a
 * 114 MB download for an engine that can never run. Ask for the adapter.
 */
export function supportsWebGPU(): Promise<boolean> {
  webgpuCheck ??= (async () => {
    const gpu = typeof navigator === 'undefined' ? undefined : navigator.gpu;
    if (!gpu) return false;

    try {
      return Boolean(await gpu.requestAdapter());
    } catch {
      return false;
    }
  })();

  return webgpuCheck;
}

/** True once the model is in the HTTP cache, i.e. the local path is instant. */
export async function isModelCached() {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open(MODEL_CACHE);
    return Boolean(await cache.match(MODEL_URL));
  } catch {
    return false;
  }
}

type Pending = {
  resolve: (mask: ImageBitmap) => void;
  reject: (error: unknown) => void;
};

/**
 * Owns the single inference worker. Requests are queued by id so a second image
 * dropped mid-run resolves against the right result.
 */
class LocalEngine {
  #worker: Worker | null = null;
  #pending = new Map<number, Pending>();
  #warmup: { resolve: () => void; reject: (error: unknown) => void }[] = [];
  #nextId = 1;

  onProgress: ((progress: Progress) => void) | null = null;
  /** Which EP the session actually built on; null until one does. */
  provider: 'webgpu' | 'wasm' | null = null;

  #ensureWorker() {
    if (this.#worker) return this.#worker;

    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.#handle(event.data);
    // Fires when the worker module itself fails to load or throws at top level;
    // `message` is the only clue the browser gives us, so keep it.
    worker.onerror = (event) =>
      this.#rejectAll(
        new MuzeelError('engineFailed', event, event.message || 'worker failed to start'),
      );

    this.#worker = worker;
    return worker;
  }

  #handle(message: WorkerResponse) {
    switch (message.type) {
      case 'progress':
        this.onProgress?.({ phase: message.phase, ratio: message.ratio });
        break;

      case 'ready':
        this.#warmup.splice(0).forEach((waiter) => waiter.resolve());
        break;

      case 'engine':
        this.provider = message.provider;
        break;

      case 'result': {
        this.#pending.get(message.id)?.resolve(message.mask);
        this.#pending.delete(message.id);
        break;
      }

      case 'error': {
        const error = new MuzeelError(message.code, undefined, message.message);
        if (message.id === undefined) {
          this.#rejectAll(error);
        } else {
          this.#pending.get(message.id)?.reject(error);
          this.#pending.delete(message.id);
        }
        break;
      }
    }
  }

  #rejectAll(error: unknown) {
    this.#pending.forEach((waiter) => waiter.reject(error));
    this.#pending.clear();
    this.#warmup.splice(0).forEach((waiter) => waiter.reject(error));
    // Drop the worker so the next attempt gets a clean one.
    this.#worker?.terminate();
    this.#worker = null;
  }

  #send(request: WorkerRequest, transfer: Transferable[] = []) {
    this.#ensureWorker().postMessage(request, transfer);
  }

  /** Downloads and compiles the model without processing anything. */
  warmup() {
    return new Promise<void>((resolve, reject) => {
      this.#warmup.push({ resolve, reject });
      this.#send({ type: 'warmup' });
    });
  }

  /** Consumes `bitmap` — it is transferred to the worker and closed there. */
  run(bitmap: ImageBitmap) {
    const id = this.#nextId++;
    return new Promise<ImageBitmap>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#send({ type: 'run', id, bitmap }, [bitmap]);
    });
  }
}

let engine: LocalEngine | null = null;

export function getLocalEngine() {
  engine ??= new LocalEngine();
  return engine;
}
