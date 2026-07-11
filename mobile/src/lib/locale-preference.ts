import { defaultLocale, isSupportedLocale, locales, type Locale } from '@/i18n/resources';
import { getDeviceLocaleCandidates } from './device-locale';
import { mmkv } from './storage';

const K_LOCALE = 'locale_preference';
const supportedLocaleByLowercase = new Map<Lowercase<Locale>, Locale>(
  locales.map((locale) => [locale.toLowerCase() as Lowercase<Locale>, locale] as const),
);

const legacyLanguageAliases: Partial<Record<string, Locale>> = {
  in: 'id',
  iw: 'he',
  no: 'nb',
};

const chineseSimplifiedRegions = new Set(['cn', 'my', 'sg']);
const chineseTraditionalRegions = new Set(['hk', 'mo', 'tw']);

function localeParts(candidate: string): string[] {
  return candidate
    .trim()
    .replace(/_/g, '-')
    .split('-')
    .filter(Boolean)
    .map((part) => part.toLowerCase());
}

function resolveChineseLocale(parts: string[]): Locale {
  if (parts.includes('hant')) return 'zh-TW';
  if (parts.includes('hans')) return 'zh-CN';
  if (parts.some((part) => chineseTraditionalRegions.has(part))) return 'zh-TW';
  if (parts.some((part) => chineseSimplifiedRegions.has(part))) return 'zh-CN';
  return 'zh-CN';
}

function resolveSupportedLocale(candidate: string | null | undefined): Locale | null {
  if (!candidate) return null;

  const normalized = candidate.trim().replace(/_/g, '-');
  const exact = supportedLocaleByLowercase.get(normalized.toLowerCase() as Lowercase<Locale>);
  if (exact) return exact;

  const parts = localeParts(normalized);
  const language = parts[0];
  if (!language) return null;

  if (language === 'zh') return resolveChineseLocale(parts);

  const legacyAlias = legacyLanguageAliases[language];
  if (legacyAlias) return legacyAlias;

  return supportedLocaleByLowercase.get(language as Lowercase<Locale>) ?? null;
}

export function resolveSupportedLocaleFromCandidates(candidates: readonly string[]): Locale {
  for (const candidate of candidates) {
    const locale = resolveSupportedLocale(candidate);
    if (locale) return locale;
  }

  return defaultLocale;
}

export function getStoredLocalePreference(): Locale | null {
  const stored = mmkv.getString(K_LOCALE);
  return isSupportedLocale(stored) ? stored : null;
}

export function resolveDeviceLocale(): Locale {
  return resolveSupportedLocaleFromCandidates(getDeviceLocaleCandidates());
}

export function resolveInitialLocale(): Locale {
  return getStoredLocalePreference() ?? resolveDeviceLocale();
}

export function persistLocalePreference(locale: Locale | null): Locale {
  if (locale) {
    mmkv.set(K_LOCALE, locale);
    return locale;
  }

  mmkv.remove(K_LOCALE);
  return resolveDeviceLocale();
}
