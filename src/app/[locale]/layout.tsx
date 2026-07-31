import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/ServiceWorker';
import { dir, getDictionary, isLocale, locales } from '@/lib/i18n/dictionaries';

const arabic = IBM_Plex_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const { meta } = getDictionary(locale);

  return {
    title: meta.title,
    description: meta.description,
    metadataBase: process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
      : undefined,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((code) => [code, `/${code}`])),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: meta.title, description: meta.description },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { meta } = getDictionary(locale);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: locale === 'ar' ? 'مُزيل' : 'Muzeel',
    description: meta.description,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    inLanguage: locale,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'SAR' },
  };

  return (
    // h-full + min-h-0 on the flex children lets the editor claim exactly the
    // space below the header without any 100vh arithmetic, while the landing
    // page is still free to grow and scroll.
    <html lang={locale} dir={dir(locale)} className={`${arabic.variable} h-full`}>
      <body className="flex h-full min-h-full flex-col font-sans">
        <script
          type="application/ld+json"
          // Static, locally-built object — no user input reaches this string.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
