/**
 * i18n — i18next with ICU (matches the web's next-intl ICU placeholders) and
 * local device-locale detection. Catalogs live in /locales and use the same
 * 30-locale registry as the web app.
 */
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

import { defaultLocale, resources } from '@/i18n/resources';
import { resolveInitialLocale } from './locale-preference';

const initialLng = resolveInitialLocale();

void i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLng,
    fallbackLng: defaultLocale,
    interpolation: { escapeValue: false },
    returnNull: false,
    react: {
      useSuspense: false,
    },
  });

export default i18n;
