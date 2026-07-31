import { ACCEPTED_TYPES, MASK_MAX_EDGE, MAX_FILE_BYTES, MAX_PIXELS } from './constants';
import { MuzeelError } from './types';

export type LoadedImage = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
};

function isAccepted(type: string): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

export async function loadImage(file: File | Blob): Promise<LoadedImage> {
  if (file.size > MAX_FILE_BYTES) throw new MuzeelError('tooLarge');
  if (!isAccepted(file.type)) throw new MuzeelError('badFormat');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (error) {
    throw new MuzeelError('corrupt', error);
  }

  if (bitmap.width * bitmap.height > MAX_PIXELS) {
    bitmap.close();
    throw new MuzeelError('tooManyPixels');
  }

  return { bitmap, width: bitmap.width, height: bitmap.height };
}

/** Scale factor that fits `width`x`height` inside a square of `maxEdge`, never upscaling. */
export function fitScale(width: number, height: number, maxEdge: number) {
  return Math.min(1, maxEdge / Math.max(width, height));
}

export function scaledSize(width: number, height: number, maxEdge: number) {
  const scale = fitScale(width, height, maxEdge);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function context2d(canvas: HTMLCanvasElement, alpha = true) {
  const context = canvas.getContext('2d', { alpha, willReadFrequently: false });
  if (!context) throw new MuzeelError('unknown');
  return context;
}

/**
 * Redraws the model's 1024² matte at working resolution. Bilinear upscaling is
 * exactly what we want here — the matte is inherently soft.
 */
export async function resampleMask(mask: ImageBitmap, width: number, height: number) {
  const size = scaledSize(width, height, MASK_MAX_EDGE);
  const canvas = createCanvas(size.width, size.height);
  const context = context2d(canvas);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(mask, 0, 0, size.width, size.height);
  mask.close();

  return createImageBitmap(canvas);
}

/** Pulls the alpha channel out of an RGBA cutout so it can be used as a matte. */
export async function extractAlphaMask(cutout: ImageBitmap) {
  const size = scaledSize(cutout.width, cutout.height, MASK_MAX_EDGE);
  const canvas = createCanvas(size.width, size.height);
  const context = context2d(canvas);

  context.drawImage(cutout, 0, 0, size.width, size.height);
  const image = context.getImageData(0, 0, size.width, size.height);
  const { data } = image;

  // Keep alpha, force RGB to white so scaling never bleeds colour into the matte.
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
  }

  context.putImageData(image, 0, 0);
  return createImageBitmap(canvas);
}
