import { NativeModules, Platform } from 'react-native';

type IOSSettingsManager = {
  settings?: {
    AppleLocale?: string;
    AppleLanguages?: string[];
  };
};

type AndroidI18nManager = {
  localeIdentifier?: string;
};

function normalizeLocale(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/_/g, '-');
  return normalized || null;
}

export function getDeviceLocaleCandidates(): string[] {
  const candidates = new Set<string>();
  const intlLocale = normalizeLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  if (intlLocale) candidates.add(intlLocale);

  if (Platform.OS === 'ios') {
    const settingsManager = NativeModules.SettingsManager as IOSSettingsManager | undefined;
    const appleLocale = normalizeLocale(settingsManager?.settings?.AppleLocale);
    if (appleLocale) candidates.add(appleLocale);
    settingsManager?.settings?.AppleLanguages?.forEach((locale) => {
      const normalized = normalizeLocale(locale);
      if (normalized) candidates.add(normalized);
    });
  }

  if (Platform.OS === 'android') {
    const i18nManager = NativeModules.I18nManager as AndroidI18nManager | undefined;
    const androidLocale = normalizeLocale(i18nManager?.localeIdentifier);
    if (androidLocale) candidates.add(androidLocale);
  }

  return [...candidates];
}

export function languageCode(locale: string): string {
  return locale.split('-')[0] ?? locale;
}
