import { render, subjectBounds } from './compose';
import type { BackgroundSettings, ShadowSettings } from './compose';
import { context2d, createCanvas } from './image';

export type ExportFormat = 'png' | 'webp' | 'jpeg';

export const formatMime: Record<ExportFormat, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
};

export const formatExtension: Record<ExportFormat, string> = {
  png: 'png',
  webp: 'webp',
  jpeg: 'jpg',
};

export type ExportSettings = {
  format: ExportFormat;
  /** 0..1, ignored for PNG. */
  quality: number;
  trim: boolean;
  /** Extra transparent margin when trimming, as a fraction of the trimmed edge. */
  padding: number;
};

export const defaultExport: ExportSettings = {
  format: 'png',
  quality: 0.92,
  trim: false,
  padding: 0,
};

type Options = {
  source: CanvasImageSource;
  matte: HTMLCanvasElement;
  width: number;
  height: number;
  background: BackgroundSettings;
  shadow: ShadowSettings;
  settings: ExportSettings;
};

function cropRegion(matte: HTMLCanvasElement, padding: number) {
  const bounds = subjectBounds(matte);
  if (!bounds) return undefined;

  const padX = bounds.width * padding;
  const padY = bounds.height * padding;

  const x = Math.max(0, bounds.x - padX);
  const y = Math.max(0, bounds.y - padY);

  return {
    x,
    y,
    width: Math.min(1 - x, bounds.width + padX * 2),
    height: Math.min(1 - y, bounds.height + padY * 2),
  };
}

export function renderFullSize({
  source,
  matte,
  width,
  height,
  background,
  shadow,
  settings,
}: Options) {
  const crop = settings.trim ? cropRegion(matte, settings.padding) : undefined;

  const outWidth = Math.max(1, Math.round(width * (crop?.width ?? 1)));
  const outHeight = Math.max(1, Math.round(height * (crop?.height ?? 1)));

  const canvas = createCanvas(outWidth, outHeight);
  const context = context2d(canvas);
  context.imageSmoothingQuality = 'high';

  // JPEG has no alpha; without this the transparent areas render black.
  const effective: BackgroundSettings =
    settings.format === 'jpeg' && background.kind === 'transparent'
      ? { kind: 'color', color: '#ffffff' }
      : background;

  render(context, outWidth, outHeight, { source, matte, background: effective, shadow, crop });
  return canvas;
}

export function toBlob(canvas: HTMLCanvasElement, settings: ExportSettings) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))),
      formatMime[settings.format],
      settings.format === 'png' ? undefined : settings.quality,
    );
  });
}

export async function exportImage(options: Options) {
  return toBlob(renderFullSize(options), options.settings);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function outputName(original: string | undefined, format: ExportFormat) {
  const base = (original ?? 'image').replace(/\.[^.]+$/, '') || 'image';
  return `${base}-muzeel.${formatExtension[format]}`;
}
