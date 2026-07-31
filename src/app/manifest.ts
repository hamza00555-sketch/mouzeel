import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'مُزيل — إزالة خلفية الصور',
    short_name: 'مُزيل',
    description:
      'أزل خلفية أي صورة في ثوانٍ، بدقة كاملة وبدون علامة مائية. المعالجة تتم داخل متصفحك.',
    start_url: '/ar',
    display: 'standalone',
    background_color: '#070a10',
    theme_color: '#070a10',
    lang: 'ar',
    dir: 'rtl',
    categories: ['photo', 'productivity', 'utilities'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
