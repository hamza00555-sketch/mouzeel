/**
 * Sample images shipped with the app. Each one is a case the model finds hard —
 * flyaway hair, a cluttered product shot, backlit fur — so clicking one is a
 * real demonstration rather than a staged win.
 *
 * All five media files are generated, not stock, so they carry no third-party
 * licence into the repo.
 */
export type Sample = {
  id: string;
  src: string;
  /** Keys into `dict.samples`. */
  labelKey: 'portrait' | 'product' | 'fur';
};

export const samples: Sample[] = [
  { id: 'portrait', src: '/media/sample-portrait.webp', labelKey: 'portrait' },
  { id: 'product', src: '/media/sample-product.webp', labelKey: 'product' },
  { id: 'fur', src: '/media/sample-fur.webp', labelKey: 'fur' },
];

export const heroBefore = '/media/hero-before.webp';
export const heroAfter = '/media/hero-after.webp';

export async function fetchSampleAsFile(sample: Sample): Promise<File> {
  const response = await fetch(sample.src);
  const blob = await response.blob();
  return new File([blob], `${sample.id}.webp`, { type: blob.type || 'image/webp' });
}
