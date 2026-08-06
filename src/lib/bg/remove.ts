import { extractAlphaMask, loadImage } from './image';
import { MuzeelError } from './types';
import type { Cutout, Progress } from './types';

async function removeOnServer(file: File | Blob, turnstileToken?: string): Promise<Blob> {
  const body = new FormData();
  body.append('image', file);
  if (turnstileToken) body.append('turnstileToken', turnstileToken);

  const response = await fetch('/api/remove-background', { method: 'POST', body });

  if (!response.ok) {
    if (response.status === 429) throw new MuzeelError('rateLimited');
    if (response.status === 413) throw new MuzeelError('tooLarge');
    if (response.status === 415) throw new MuzeelError('badFormat');

    throw new MuzeelError(
      'serverFailed',
      undefined,
      await response.text().catch(() => response.statusText),
    );
  }

  return response.blob();
}

export type RemoveOptions = {
  turnstileToken?: string;
  onProgress?: (progress: Progress) => void;
};

/**
 * Segmentation runs on the server. It used to run in the browser on WebGPU, and
 * that path is gone: it needed a 114 MB download, a WebGPU adapter, self-hosted
 * ONNX Runtime binaries and a service worker to cache them — four production
 * failures came out of that machinery, none out of the editor it fed.
 */
export async function removeBackground(
  file: File | Blob,
  { turnstileToken, onProgress }: RemoveOptions = {},
): Promise<Cutout> {
  onProgress?.({ phase: 'reading', ratio: null });
  const { bitmap, width, height } = await loadImage(file);

  try {
    onProgress?.({ phase: 'processing', ratio: null });
    const cutout = await createImageBitmap(await removeOnServer(file, turnstileToken));

    onProgress?.({ phase: 'refining', ratio: null });
    const mask = await extractAlphaMask(cutout);
    cutout.close();

    onProgress?.({ phase: 'done', ratio: 1 });
    return { source: bitmap, mask, width, height };
  } catch (error) {
    bitmap.close();
    throw error;
  }
}
