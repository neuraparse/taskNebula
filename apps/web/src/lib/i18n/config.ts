/**
 * Central i18n configuration for TaskNebula.
 *
 * Locales:
 *  - en: English (default)
 *  - tr: Turkish
 *  - de: German
 *  - es: Spanish
 *
 * The Arabic locale (`ar`) is intentionally not yet listed, but the RTL
 * infrastructure (`isRtl` + Radix `DirectionProvider`) is wired so it can
 * land in a follow-up without further layout surgery.
 */

export const locales = ['en', 'tr', 'de', 'es'] as const;
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

/** Human-readable labels for the language switcher. Native names. */
export const localeLabels: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
  es: 'Español',
};
