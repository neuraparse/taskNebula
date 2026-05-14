import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { DirectionProvider } from '@/lib/i18n/direction-provider';
import { getDirection, isSupportedLocale, locales } from '@/lib/i18n/config';

// Statically generate all supported locale segments at build time.
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Reject unsupported locales early so we don't try to load a missing
  // catalog and surface a confusing 500.
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  // Enables static rendering for this segment.
  setRequestLocale(locale);

  // Pre-load the catalog so client components rendered below this boundary
  // get the right messages without an extra round-trip.
  const messages = await getMessages();
  const dir = getDirection(locale);
  const resolvedDir = dir === 'rtl' ? 'rtl' : 'ltr';

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DirectionProvider dir={resolvedDir}>
        {/*
          A small inline script keeps <html lang> + dir in sync with the
          active locale even on client-side route transitions. Server-side
          we also set them on the <html> element via the root layout.
        */}
        <span
          data-locale={locale}
          data-direction={resolvedDir}
          aria-hidden="true"
          className="sr-only"
        />
        {children}
      </DirectionProvider>
    </NextIntlClientProvider>
  );
}

// Only the locales returned by `generateStaticParams` are valid here.
export const dynamicParams = false;
