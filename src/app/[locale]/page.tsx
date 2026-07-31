import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Studio } from '@/components/Studio';
import { getDictionary, isLocale } from '@/lib/i18n/dictionaries';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const other = locale === 'ar' ? 'en' : 'ar';

  return (
    <>
      <header className="z-20 shrink-0 border-b border-ink-800/80 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-400 text-sm font-bold text-ink-950">
              م
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-bold text-ink-50">{dict.nav.brand}</span>
              <span className="mt-0.5 text-[11px] text-ink-400">{dict.nav.tagline}</span>
            </span>
          </Link>

          <Link
            href={`/${other}`}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-200 transition hover:bg-ink-800"
          >
            {dict.nav.switchLang}
          </Link>
        </div>
      </header>

      {/*
        Studio owns the page body, hero and feature grid included, so it can drop
        the marketing copy the moment an image loads and hand the editor the full
        viewport. Passing that markup down as props instead would trip React's
        key warning: JSX crossing the server/client boundary as a prop loses its
        static-children marker. Everything Studio renders comes from `dict`, so
        the copy is still server-rendered for SEO.
      */}
      <Studio dict={dict} />
    </>
  );
}
