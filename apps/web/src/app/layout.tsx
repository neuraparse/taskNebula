import type { Metadata, Viewport } from 'next';
import './globals.css';
import '@livekit/components-styles';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';

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
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
        <Providers>{children}</Providers>
        <Toaster />
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
