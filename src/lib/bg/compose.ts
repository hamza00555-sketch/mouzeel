import { context2d, createCanvas } from './image';

export type EdgeSettings = {
  /** Gaussian blur in mask pixels; softens hair and fur. */
  feather: number;
  /** -1 eats into the subject, +1 grows it. Kills light fringes. */
  shrink: number;
  /** 0 keeps the soft matte, 1 pushes it towards a hard cutout. */
  threshold: number;
};

export type BackgroundSettings =
  | { kind: 'transparent' }
  | { kind: 'color'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle: number }
  | { kind: 'image'; bitmap: ImageBitmap };

export type ShadowSettings = {
  enabled: boolean;
  blur: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
};

export const defaultEdges: EdgeSettings = { feather: 0.5, shrink: 0, threshold: 0.15 };
export const defaultBackground: BackgroundSettings = { kind: 'transparent' };
export const defaultShadow: ShadowSettings = {
  enabled: false,
  blur: 24,
  opacity: 0.35,
  offsetX: 0,
  offsetY: 18,
};

/**
 * CSS filters only transform RGB — `brightness`/`contrast` leave alpha alone —
 * so the matte, which lives in the alpha channel, has to be levelled by hand.
 * Blur still goes through the GPU; only this 256-entry LUT pass runs in JS, and
 * only when the edge settings or a brush stroke actually change.
 */
function alphaLut({ shrink, threshold }: EdgeSettings) {
  const gain = 1 + shrink * 0.6; // shifts the 50% isoline: >1 grows, <1 shrinks
  const contrast = 1 + threshold * 8;
  const lut = new Uint8ClampedArray(256);

  for (let i = 0; i < 256; i++) {
    const value = (i / 255) * gain;
    lut[i] = ((value - 0.5) * contrast + 0.5) * 255;
  }

  return lut;
}

/** Applies feather + levels to the raw matte, producing the matte we composite with. */
export function refineMask(
  mask: CanvasImageSource,
  width: number,
  height: number,
  edges: EdgeSettings,
): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const context = context2d(canvas);

  if (edges.feather > 0) context.filter = `blur(${edges.feather}px)`;
  context.drawImage(mask, 0, 0, width, height);
  context.filter = 'none';

  if (edges.shrink === 0 && edges.threshold === 0) return canvas;

  const lut = alphaLut(edges);
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;

  for (let i = 3; i < data.length; i += 4) {
    data[i] = lut[data[i]];
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

function paintBackground(
  context: CanvasRenderingContext2D,
  background: BackgroundSettings,
  width: number,
  height: number,
) {
  switch (background.kind) {
    case 'transparent':
      return;

    case 'color':
      context.fillStyle = background.color;
      context.fillRect(0, 0, width, height);
      return;

    case 'gradient': {
      const radians = (background.angle * Math.PI) / 180;
      const half = Math.max(width, height) / 2;
      const dx = Math.cos(radians) * half;
      const dy = Math.sin(radians) * half;

      const gradient = context.createLinearGradient(
        width / 2 - dx,
        height / 2 - dy,
        width / 2 + dx,
        height / 2 + dy,
      );
      gradient.addColorStop(0, background.from);
      gradient.addColorStop(1, background.to);

      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      return;
    }

    case 'image': {
      // Cover: fill the frame, cropping the overflow.
      const scale = Math.max(
        width / background.bitmap.width,
        height / background.bitmap.height,
      );
      const drawWidth = background.bitmap.width * scale;
      const drawHeight = background.bitmap.height * scale;

      context.drawImage(
        background.bitmap,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
    }
  }
}

function paintShadow(
  context: CanvasRenderingContext2D,
  matte: CanvasImageSource,
  shadow: ShadowSettings,
  width: number,
  height: number,
  scale: number,
) {
  const layer = createCanvas(width, height);
  const layerContext = context2d(layer);

  layerContext.filter = `blur(${shadow.blur * scale}px)`;
  layerContext.drawImage(matte, shadow.offsetX * scale, shadow.offsetY * scale, width, height);
  layerContext.filter = 'none';

  // Tint the blurred silhouette black without touching its alpha.
  layerContext.globalCompositeOperation = 'source-in';
  layerContext.fillStyle = '#000';
  layerContext.fillRect(0, 0, width, height);

  context.globalAlpha = shadow.opacity;
  context.drawImage(layer, 0, 0);
  context.globalAlpha = 1;
}

export type RenderOptions = {
  source: CanvasImageSource;
  /** Already refined by `refineMask`. */
  matte: CanvasImageSource;
  background: BackgroundSettings;
  shadow: ShadowSettings;
  /** Crop in source-relative units (0..1), for trim-to-subject exports. */
  crop?: { x: number; y: number; width: number; height: number };
};

/**
 * Draws the finished image into `context`, whose canvas is already sized to the
 * output. The same routine serves the on-screen preview and the full-resolution
 * export, so what the user sees is what they download.
 */
export function render(
  context: CanvasRenderingContext2D,
  outWidth: number,
  outHeight: number,
  { source, matte, background, shadow, crop }: RenderOptions,
) {
  context.clearRect(0, 0, outWidth, outHeight);

  const region = crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const fullWidth = outWidth / region.width;
  const fullHeight = outHeight / region.height;
  const offsetX = -region.x * fullWidth;
  const offsetY = -region.y * fullHeight;

  paintBackground(context, background, outWidth, outHeight);

  // Shadow scale keeps the blur visually identical across preview and export.
  const scale = fullWidth / 1000;

  const subject = createCanvas(outWidth, outHeight);
  const subjectContext = context2d(subject);
  subjectContext.imageSmoothingQuality = 'high';
  subjectContext.drawImage(source, offsetX, offsetY, fullWidth, fullHeight);
  subjectContext.globalCompositeOperation = 'destination-in';
  subjectContext.drawImage(matte, offsetX, offsetY, fullWidth, fullHeight);

  if (shadow.enabled) {
    const shifted = createCanvas(outWidth, outHeight);
    const shiftedContext = context2d(shifted);
    shiftedContext.drawImage(matte, offsetX, offsetY, fullWidth, fullHeight);
    paintShadow(context, shifted, shadow, outWidth, outHeight, scale);
  }

  context.drawImage(subject, 0, 0);
}

/**
 * Tightest box containing visible pixels, in 0..1 units. Returns null when the
 * matte is empty so callers can skip trimming rather than crop to nothing.
 */
export function subjectBounds(matte: HTMLCanvasElement, alphaCutoff = 8) {
  const { width, height } = matte;
  const { data } = context2d(matte).getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= alphaCutoff) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;

  return {
    x: minX / width,
    y: minY / height,
    width: (maxX - minX + 1) / width,
    height: (maxY - minY + 1) / height,
  };
}
