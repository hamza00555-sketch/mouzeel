import { extractAlphaMask, loadImage, resampleMask } from './image';
import { getLocalEngine, isModelCached, supportsWebGPU } from './local-engine';
import { MuzeelError } from './types';
import type { Cutout, ProcessedBy, ProcessingMode, Progress } from './types';

let serverAvailable: Promise<boolean> | null = null;

/** Asked once per session; the server reports whether FAL_KEY is configured. */
export function isServerAvailable() {
  serverAvailable ??= fetch('/api/remove-background')
    .then((response) => (response.ok ? response.json() : { available: false }))
    .then((body: { available?: boolean }) => Boolean(body.available))
    .catch(() => false);

  return serverAvailable;
}

async function removeOnServer(file: File | Blob, turnstileToken?: string): Promise<Blob> {
  const body = new FormData();
  body.append('image', file);
  if (turnstileToken) body.append('turnstileToken', turnstileToken);

  const response = await fetch('/api/remove-background', { method: 'POST', body });

  if (!response.ok) {
    if (response.status === 429) throw new MuzeelError('rateLimited');
    throw new MuzeelError('serverFailed', await response.text().catch(() => response.statusText));
  }

  return response.blob();
}

/**
 * Picks where to run. The local model is a 114 MB download, so a first-time
 * visitor would stare at a progress bar before seeing anything — we send that
 * first image to the server instead and warm the local engine in the background.
 * Every image after that runs on-device.
 */
async function resolveTarget(mode: ProcessingMode): Promise<ProcessedBy> {
  if (mode === 'local') {
    if (!(await supportsWebGPU())) throw new MuzeelError('noEngine');
    return 'local';
  }

  if (mode === 'server') {
    if (!(await isServerAvailable())) throw new MuzeelError('serverFailed');
    return 'server';
  }

  if (!(await supportsWebGPU())) {
    if (await isServerAvailable()) return 'server';
    throw new MuzeelError('noEngine');
  }

  if (await isModelCached()) return 'local';
  return (await isServerAvailable()) ? 'server' : 'local';
}

/** Failures that say nothing about the image, so retrying elsewhere is worthwhile. */
const RECOVERABLE = new Set(['networkModel', 'engineFailed']);

export type RemoveOptions = {
  mode?: ProcessingMode;
  turnstileToken?: string;
  onProgress?: (progress: Progress) => void;
};

export async function removeBackground(
  file: File | Blob,
  { mode = 'auto', turnstileToken, onProgress }: RemoveOptions = {},
): Promise<Cutout> {
  onProgress?.({ phase: 'reading', ratio: null });
  const { bitmap, width, height } = await loadImage(file);

  const viaServer = async (): Promise<Cutout> => {
    onProgress?.({ phase: 'processing', ratio: null });
    const cutout = await createImageBitmap(await removeOnServer(file, turnstileToken));

    onProgress?.({ phase: 'refining', ratio: null });
    const mask = await extractAlphaMask(cutout);
    cutout.close();

    onProgress?.({ phase: 'done', ratio: 1 });
    return { source: bitmap, mask, width, height, processedBy: 'server' };
  };

  const viaLocal = async (): Promise<Cutout> => {
    const engine = getLocalEngine();
    engine.onProgress = (progress) => onProgress?.(progress);

    // The worker takes ownership of the bitmap it runs on, so hand it a copy —
    // the original has to survive for the editor, and for a server retry.
    const raw = await engine.run(await createImageBitmap(bitmap));

    onProgress?.({ phase: 'refining', ratio: null });
    const mask = await resampleMask(raw, width, height);

    onProgress?.({ phase: 'done', ratio: 1 });
    return { source: bitmap, mask, width, height, processedBy: 'local' };
  };

  try {
    const target = await resolveTarget(mode);

    try {
      return target === 'server' ? await viaServer() : await viaLocal();
    } catch (error) {
      // A blocked model download or an engine that won't start should not be a
      // dead end when the server can still do the job.
      const recoverable =
        mode === 'auto' &&
        target === 'local' &&
        error instanceof MuzeelError &&
        RECOVERABLE.has(error.code);

      if (recoverable && (await isServerAvailable())) return await viaServer();
      throw error;
    }
  } catch (error) {
    bitmap.close();
    throw error;
  }
}

/**
 * Downloads and compiles the local model in the background. Safe to call
 * repeatedly; failures are swallowed because this is pure optimisation.
 */
export async function warmLocalEngine(onProgress?: (progress: Progress) => void) {
  if (!(await supportsWebGPU())) return false;

  const engine = getLocalEngine();
  if (onProgress) engine.onProgress = onProgress;

  return engine
    .warmup()
    .then(() => true)
    .catch(() => false);
}
