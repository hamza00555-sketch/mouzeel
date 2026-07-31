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
      {/*
        Apple's nav bar: 48px tall, heavily blurred, barely-there text. This is
        the one place glass earns its keep — it has to sit over both the black
        hero and the white tool section without becoming a visible slab.
      */}
      <header className="sticky top-0 z-sticky h-12 shrink-0 border-b border-white/[0.08] bg-black/60 backdrop-blur-xl backdrop-saturate-150">
        <nav className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-6 text-[13px]">
          <Link
            href={`/${locale}`}
            className="font-semibold tracking-tight text-chalk transition-opacity hover:opacity-70"
          >
            {dict.nav.brand}
          </Link>

          <Link
            href={`/${other}`}
            className="text-chalk-soft transition-colors hover:text-chalk"
            hrefLang={other}
          >
            {dict.nav.switchLang}
          </Link>
        </nav>
      </header>

      {/*
        Studio owns the page body, marketing copy included, so it can drop the
        whole landing page the moment an image loads and hand the editor the full
        viewport. Passing that markup down as props instead would trip React's
        key warning: JSX crossing the server/client boundary as a prop loses its
        static-children marker. Everything Studio renders comes from `dict`, so
        the copy is still server-rendered for SEO.
      */}
      <Studio dict={dict} />
    </>
  );
}
