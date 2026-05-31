import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { DirectionProvider } from '@/lib/i18n/direction-provider';
import './globals.css';
import '@livekit/components-styles';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';
import {
  LOCALE_COOKIE,
  defaultLocale,
  getDirection,
  isSupportedLocale,
  type Locale,
} from '@/lib/i18n/config';

export const metadata: Metadata = {
  title: 'TaskNebula - AI-Native Project Management',
  description: 'Real-time, keyboard-first project management platform powered by AI',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TaskNebula',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};

/**
 * Resolve the active locale for the request. Order of precedence:
 *  1. `x-tasknebula-locale` header (set by the next-intl middleware for
 *     paths under a `[locale]` segment).
 *  2. `tasknebula-locale` cookie (set by the language switcher).
 *  3. The default locale.
 */
async function resolveLocale(): Promise<Locale> {
  const headerStore = await headers();
  const fromHeader = headerStore.get('x-tasknebula-locale');
  if (isSupportedLocale(fromHeader)) return fromHeader;

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(fromCookie)) return fromCookie;

  return defaultLocale;
}

async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  try {
    const mod = await import(`../../messages/${locale}.json`);
    return mod.default as Record<string, unknown>;
  } catch {
    const fallback = await import(`../../messages/${defaultLocale}.json`);
    return fallback.default as Record<string, unknown>;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await resolveLocale();
  const dir = getDirection(locale);
  const messages = await loadMessages(locale);

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var raw = localStorage.getItem('tasknebula-theme');
                  var state = raw ? (JSON.parse(raw).state || {}) : {};
                  var theme = state.colorTheme || 'default';
                  var visual = state.visualStyle || 'modern';
                  var anims = state.enableAnimations === false ? 'false' : 'true';
                  var root = document.documentElement;
                  root.setAttribute('data-theme', theme);
                  root.setAttribute('data-visual', visual);
                  root.setAttribute('data-animations', anims);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        {/*
          DirectionProvider primes Radix primitives with the correct
          reading direction. NextIntlClientProvider exposes the same
          message catalog to client components outside the [locale]
          segment (e.g. /auth/signin) so the language switcher works
          everywhere. The inner [locale]/layout re-installs both with
          its own params to keep static rendering correct under that
          subtree.
        */}
        <DirectionProvider dir={dir}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <Providers>{children}</Providers>
            <Toaster />
          </NextIntlClientProvider>
        </DirectionProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                if (!('serviceWorker' in navigator)) {
                  return;
                }

                const isLocalHost =
                  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) ||
                  window.location.hostname.endsWith('.local');
                const shouldRegister = ${process.env.NODE_ENV === 'production' ? 'true' : 'false'} && !isLocalHost;

                window.addEventListener('load', async () => {
                  try {
                    if (!shouldRegister) {
                      const registrations = await navigator.serviceWorker.getRegistrations();
                      await Promise.all(
                        registrations.map((registration) => registration.unregister().catch(() => false))
                      );

                      if ('caches' in window) {
                        const cacheKeys = await caches.keys();
                        await Promise.all(
                          cacheKeys
                            .filter((key) => key.startsWith('tasknebula-'))
                            .map((key) => caches.delete(key))
                        );
                      }

                      return;
                    }

                    await navigator.serviceWorker.register('/sw.js');
                  } catch {
                    // Keep localhost and production consoles clean. The app works without SW.
                  }
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
