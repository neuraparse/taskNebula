import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isSupportedLocale, type Locale } from './config';

/**
 * next-intl request config. Wired in `next.config.ts` via the
 * `createNextIntlPlugin('./src/lib/i18n/request.ts')` factory.
 *
 * We resolve the active locale from the route segment (`requestLocale`)
 * and fall back to the default. The full message catalog is loaded for
 * the active locale only.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = isSupportedLocale(requested) ? requested : defaultLocale;

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
