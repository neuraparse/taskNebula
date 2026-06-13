/**
 * Central i18n configuration for TaskNebula.
 *
 * 30 locales ship out of the box. English (`en`) is the default and the
 * source catalog; every other `messages/<locale>.json` is translated from it.
 * Right-to-left scripts (Arabic, Hebrew) are handled by the `isRtl` helper +
 * Radix `DirectionProvider`, so no per-locale layout surgery is needed.
 *
 * Message catalogs load dynamically per request (see `request.ts`), the
 * language switcher and middleware both derive from `locales`/`localeLabels`
 * here — so adding a locale is: append its code below, add a native label,
 * and drop in `messages/<code>.json`.
 */

export const locales = [
  'en',
  'tr',
  'de',
  'es',
  'fr',
  'it',
  'pt',
  'nl',
  'pl',
  'ru',
  'uk',
  'cs',
  'sv',
  'da',
  'fi',
  'nb',
  'ro',
  'hu',
  'el',
  'bg',
  'zh-CN',
  'zh-TW',
  'ja',
  'ko',
  'hi',
  'id',
  'th',
  'vi',
  'ar',
  'he',
] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Locales whose primary script renders right-to-left. */
export const rtlLocales: readonly string[] = ['ar', 'he', 'fa', 'ur'];

/** Cookie used by the language switcher and middleware to persist a choice. */
export const LOCALE_COOKIE = 'tasknebula-locale';

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function isRtlLocale(value: string | null | undefined): boolean {
  if (!value) return false;
  return rtlLocales.includes(value);
}

export function getDirection(locale: string | null | undefined): 'rtl' | 'ltr' {
  return isRtlLocale(locale) ? 'rtl' : 'ltr';
}

/**
 * Negotiate the best supported locale from an `Accept-Language` header so a
 * first-time visitor sees the app in their device/browser language. Honors
 * quality (`q=`) ordering and falls back from a regional tag to its base
 * language (e.g. `fr-FR` → `fr`, `zh` → `zh-CN`). Returns `null` when nothing
 * matches, leaving the caller to use {@link defaultLocale}.
 */
export function matchLocaleFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranges = header
    .split(',')
    .map((part) => {
      const segments = part.trim().split(';');
      const tag = (segments[0] ?? '').trim().toLowerCase();
      const qParam = segments.find((p) => p.trim().startsWith('q='));
      const quality = qParam ? Number.parseFloat(qParam.slice(qParam.indexOf('=') + 1)) : 1;
      return { tag, quality: Number.isNaN(quality) ? 1 : quality };
    })
    .filter((r) => r.tag && r.tag !== '*')
    .sort((a, b) => b.quality - a.quality);

  const lower = locales.map((l) => l.toLowerCase());
  for (const { tag } of ranges) {
    // Exact match, e.g. "zh-cn" → "zh-CN".
    const exact = lower.indexOf(tag);
    if (exact !== -1) return locales[exact] ?? null;
    // Base-language match, e.g. "fr-fr" → "fr", or "zh" → first "zh-*".
    const base = tag.split('-')[0] ?? tag;
    const baseIdx = lower.indexOf(base);
    if (baseIdx !== -1) return locales[baseIdx] ?? null;
    const anyBase = lower.findIndex((l) => (l.split('-')[0] ?? l) === base);
    if (anyBase !== -1) return locales[anyBase] ?? null;
  }
  return null;
}

/** Human-readable labels for the language switcher. Native names. */
export const localeLabels: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  uk: 'Українська',
  cs: 'Čeština',
  sv: 'Svenska',
  da: 'Dansk',
  fi: 'Suomi',
  nb: 'Norsk Bokmål',
  ro: 'Română',
  hu: 'Magyar',
  el: 'Ελληνικά',
  bg: 'Български',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  ar: 'العربية',
  he: 'עברית',
};
