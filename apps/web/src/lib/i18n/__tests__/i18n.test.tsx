/**
 * @jest-environment jsdom
 *
 * Smoke test for the FEAT-34 i18n scaffolding. We mock `next-intl` so
 * the test does not need the full next-intl + Next.js request pipeline,
 * mirror the public API (`useTranslations` / `NextIntlClientProvider`),
 * and verify that a component rendered under a `tr` provider receives
 * the expected Turkish string from `messages/tr.json`.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import enMessages from '../../../../messages/en.json';
import trMessages from '../../../../messages/tr.json';
import { defaultLocale, isRtlLocale, isSupportedLocale, localeLabels, locales } from '../config';

type Messages = Record<string, Record<string, string>>;
const MessagesContext = React.createContext<{ locale: string; messages: Messages }>({
  locale: defaultLocale,
  messages: enMessages as unknown as Messages,
});

jest.mock('next-intl', () => {
  return {
    __esModule: true,
    NextIntlClientProvider: ({
      children,
      locale,
      messages,
    }: {
      children: React.ReactNode;
      locale: string;
      messages: Messages;
    }) => (
      <MessagesContext.Provider value={{ locale, messages }}>{children}</MessagesContext.Provider>
    ),
    useTranslations: (namespace?: string) => {
      const ctx = React.useContext(MessagesContext);
      return (key: string, values?: Record<string, string | number>) => {
        const ns = namespace ? ctx.messages[namespace] : undefined;
        let value = ns
          ? ns[key]
          : ((ctx.messages as unknown as Record<string, string>)[key] ?? key);
        if (typeof value !== 'string') return key;
        if (values) {
          for (const [k, v] of Object.entries(values)) {
            value = value.replace(new RegExp(`{${k}}`, 'g'), String(v));
          }
        }
        return value;
      };
    },
    useLocale: () => React.useContext(MessagesContext).locale,
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { NextIntlClientProvider, useTranslations } = require('next-intl') as {
  NextIntlClientProvider: React.FC<{
    children: React.ReactNode;
    locale: string;
    messages: Messages;
  }>;
  useTranslations: (
    namespace?: string
  ) => (key: string, values?: Record<string, string | number>) => string;
};

function Greeting({ name }: { name: string }) {
  const t = useTranslations('dashboard');
  return <h1 data-testid="greeting">{t('welcome_back', { name })}</h1>;
}

function NavLabel() {
  const t = useTranslations('nav');
  return <span data-testid="nav-label">{t('my_issues')}</span>;
}

describe('i18n config', () => {
  it('ships 30 locales with a native label for each, English first/default', () => {
    expect(defaultLocale).toBe('en');
    expect(locales[0]).toBe('en');
    expect(locales).toHaveLength(30);
    // the originally scaffolded locales are still present
    expect(locales).toEqual(expect.arrayContaining(['en', 'tr', 'de', 'es']));
    // no duplicates, and every locale has a non-empty native label
    expect(new Set(locales).size).toBe(locales.length);
    for (const code of locales) {
      expect(localeLabels[code]).toBeTruthy();
    }
  });

  it('treats arabic/hebrew/persian/urdu as RTL', () => {
    for (const code of ['ar', 'he', 'fa', 'ur']) {
      expect(isRtlLocale(code)).toBe(true);
    }
    expect(isRtlLocale('en')).toBe(false);
    expect(isRtlLocale('tr')).toBe(false);
  });

  it('validates supported locales', () => {
    expect(isSupportedLocale('tr')).toBe(true);
    expect(isSupportedLocale('xx')).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
  });
});

describe('useTranslations under a Turkish provider', () => {
  it('renders the Turkish dashboard greeting with interpolation', () => {
    render(
      <NextIntlClientProvider locale="tr" messages={trMessages as unknown as Messages}>
        <Greeting name="Eren" />
      </NextIntlClientProvider>
    );

    expect(screen.getByTestId('greeting')).toHaveTextContent('Tekrar hoş geldin, Eren');
  });

  it('renders the Turkish nav label for "My Issues"', () => {
    render(
      <NextIntlClientProvider locale="tr" messages={trMessages as unknown as Messages}>
        <NavLabel />
      </NextIntlClientProvider>
    );

    expect(screen.getByTestId('nav-label')).toHaveTextContent('İşlerim');
  });

  it('falls back to English under an English provider', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages as unknown as Messages}>
        <NavLabel />
      </NextIntlClientProvider>
    );

    expect(screen.getByTestId('nav-label')).toHaveTextContent('My Issues');
  });
});

describe('catalog parity', () => {
  // Cheap drift detector: every locale should ship the same top-level
  // namespaces. Per-key parity is left to a dedicated script.
  it('ships the same top-level namespaces across locales', async () => {
    const catalogs = await Promise.all(
      (['en', 'tr', 'de', 'es'] as const).map(async (locale) => {
        const mod = await import(`../../../../messages/${locale}.json`);
        return { locale, keys: Object.keys(mod.default).sort() };
      })
    );

    const base = catalogs[0]!.keys;
    for (const cat of catalogs) {
      expect({ locale: cat.locale, keys: cat.keys }).toEqual({
        locale: cat.locale,
        keys: base,
      });
    }
  });
});
