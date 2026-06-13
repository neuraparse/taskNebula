import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, defaultLocale, isSupportedLocale, type Locale } from './config';

/**
 * next-intl request config. Wired in `next.config.ts` via the
 * `createNextIntlPlugin('./src/lib/i18n/request.ts')` factory.
 *
 * This app uses a custom middleware (not next-intl's `createMiddleware`), so
 * next-intl's own `requestLocale` signal isn't reliably populated. We resolve
 * the active locale in order:
 *   1. `requestLocale` (the `[locale]` route segment, when present)
 *   2. the `x-tasknebula-locale` request header the middleware forwards
 *   3. the persisted `tasknebula-locale` cookie
 *   4. the default locale
 * This keeps getMessages()/getTranslations() — and therefore every server
 * component and the client provider — in sync with the chosen language.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let resolved: string | undefined = await requestLocale;

  if (!isSupportedLocale(resolved)) {
    const headerStore = await headers();
    resolved = headerStore.get('x-tasknebula-locale') ?? undefined;
  }
  if (!isSupportedLocale(resolved)) {
    const cookieStore = await cookies();
    resolved = cookieStore.get(LOCALE_COOKIE)?.value;
  }

  const locale: Locale = isSupportedLocale(resolved) ? resolved : defaultLocale;

  // Dynamic import keeps each locale catalog in its own chunk.
  const messages = (await import(`../../../messages/${locale}.json`)).default as Record<
    string,
    unknown
  >;

  return {
    locale,
    messages,
  };
});
