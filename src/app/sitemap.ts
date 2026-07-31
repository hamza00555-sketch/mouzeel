import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n/dictionaries';

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://muzeel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: `${site}/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: locale === 'ar' ? 1 : 0.8,
    alternates: {
      languages: Object.fromEntries(locales.map((code) => [code, `${site}/${code}`])),
    },
  }));
}
