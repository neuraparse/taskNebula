'use client';

/**
 * Root-level error boundary.
 *
 * Catches errors that escape the per-route `error.tsx` (e.g. errors thrown in
 * the root layout or the providers). MUST render its own `<html>` and `<body>`
 * because the surrounding layout has already failed — that's the Next.js
 * contract for global-error.
 */

import { useEffect, useMemo, useState } from 'react';
import { createTranslator } from 'next-intl';
import { AlertOctagon } from 'lucide-react';
import enMessages from '../../messages/en.json';
import {
  LOCALE_COOKIE,
  defaultLocale,
  getDirection,
  isSupportedLocale,
  matchLocaleFromAcceptLanguage,
  type Locale,
} from '@/lib/i18n/config';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

type Messages = Record<string, unknown>;
type GlobalErrorMessageKey = 'title' | 'description' | 'reference' | 'reload';

const messageLoaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  en: async () => ({ default: enMessages as Messages }),
  tr: () => import('../../messages/tr.json') as Promise<{ default: Messages }>,
  de: () => import('../../messages/de.json') as Promise<{ default: Messages }>,
  es: () => import('../../messages/es.json') as Promise<{ default: Messages }>,
  fr: () => import('../../messages/fr.json') as Promise<{ default: Messages }>,
  it: () => import('../../messages/it.json') as Promise<{ default: Messages }>,
  pt: () => import('../../messages/pt.json') as Promise<{ default: Messages }>,
  nl: () => import('../../messages/nl.json') as Promise<{ default: Messages }>,
  pl: () => import('../../messages/pl.json') as Promise<{ default: Messages }>,
  ru: () => import('../../messages/ru.json') as Promise<{ default: Messages }>,
  uk: () => import('../../messages/uk.json') as Promise<{ default: Messages }>,
  cs: () => import('../../messages/cs.json') as Promise<{ default: Messages }>,
  sv: () => import('../../messages/sv.json') as Promise<{ default: Messages }>,
  da: () => import('../../messages/da.json') as Promise<{ default: Messages }>,
  fi: () => import('../../messages/fi.json') as Promise<{ default: Messages }>,
  nb: () => import('../../messages/nb.json') as Promise<{ default: Messages }>,
  ro: () => import('../../messages/ro.json') as Promise<{ default: Messages }>,
  hu: () => import('../../messages/hu.json') as Promise<{ default: Messages }>,
  el: () => import('../../messages/el.json') as Promise<{ default: Messages }>,
  bg: () => import('../../messages/bg.json') as Promise<{ default: Messages }>,
  'zh-CN': () => import('../../messages/zh-CN.json') as Promise<{ default: Messages }>,
  'zh-TW': () => import('../../messages/zh-TW.json') as Promise<{ default: Messages }>,
  ja: () => import('../../messages/ja.json') as Promise<{ default: Messages }>,
  ko: () => import('../../messages/ko.json') as Promise<{ default: Messages }>,
  hi: () => import('../../messages/hi.json') as Promise<{ default: Messages }>,
  id: () => import('../../messages/id.json') as Promise<{ default: Messages }>,
  th: () => import('../../messages/th.json') as Promise<{ default: Messages }>,
  vi: () => import('../../messages/vi.json') as Promise<{ default: Messages }>,
  ar: () => import('../../messages/ar.json') as Promise<{ default: Messages }>,
  he: () => import('../../messages/he.json') as Promise<{ default: Messages }>,
};

function readCookieLocale(): Locale | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  if (!match) {
    return null;
  }

  const value = decodeURIComponent(match.slice(LOCALE_COOKIE.length + 1));
  return isSupportedLocale(value) ? value : null;
}

function resolveClientLocale(): Locale {
  const cookieLocale = readCookieLocale();
  if (cookieLocale) {
    return cookieLocale;
  }

  if (typeof navigator !== 'undefined') {
    const languageHeader =
      Array.isArray(navigator.languages) && navigator.languages.length > 0
        ? navigator.languages.join(',')
        : navigator.language;
    const matchedLocale = matchLocaleFromAcceptLanguage(languageHeader);
    if (matchedLocale) {
      return matchedLocale;
    }
  }

  return defaultLocale;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [locale, setLocale] = useState<Locale>(() => resolveClientLocale());
  const [messages, setMessages] = useState<Messages>(() => enMessages as Messages);
  const t = useMemo(
    () =>
      createTranslator({
        locale,
        messages,
        namespace: 'errorPages.global',
      }) as unknown as (key: GlobalErrorMessageKey) => string,
    [locale, messages]
  );

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Global error boundary caught error', error);
  }, [error]);

  useEffect(() => {
    const resolvedLocale = resolveClientLocale();
    setLocale(resolvedLocale);

    let disposed = false;
    messageLoaders[resolvedLocale]()
      .then((module) => {
        if (!disposed) {
          setMessages(module.default);
        }
      })
      .catch(() => {
        if (!disposed) {
          setLocale(defaultLocale);
          setMessages(enMessages as Messages);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  const dir = getDirection(locale);

  return (
    <html lang={locale} dir={dir}>
      <body className="font-sans antialiased">
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: '#0a0a0a',
            color: '#fafafa',
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                color: '#f87171',
              }}
            >
              <AlertOctagon size={20} aria-hidden />
              <h1 style={{ fontSize: 18, margin: 0, fontWeight: 600 }}>{t('title')}</h1>
            </div>
            <p style={{ margin: '0 0 16px', color: '#a1a1aa', fontSize: 14 }}>{t('description')}</p>
            {error.digest && (
              <p style={{ fontSize: 12, color: '#71717a', margin: '0 0 16px' }}>
                {t('reference')}{' '}
                <code style={{ fontFamily: 'ui-monospace, monospace' }}>{error.digest}</code>
              </p>
            )}
            <button
              onClick={reset}
              style={{
                background: '#fafafa',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t('reload')}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
