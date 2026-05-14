'use client';

/**
 * Root-level error boundary.
 *
 * Catches errors that escape the per-route `error.tsx` (e.g. errors thrown in
 * the root layout or the providers). MUST render its own `<html>` and `<body>`
 * because the surrounding layout has already failed — that's the Next.js
 * contract for global-error.
 */

import { useEffect } from 'react';
import { AlertOctagon } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Global error boundary caught error', error);
  }, [error]);

  return (
    <html lang="en">
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
              <h1 style={{ fontSize: 18, margin: 0, fontWeight: 600 }}>
                Application error
              </h1>
            </div>
            <p style={{ margin: '0 0 16px', color: '#a1a1aa', fontSize: 14 }}>
              A critical error prevented the app from loading. Please reload
              the page. If the problem persists, contact support.
            </p>
            {error.digest && (
              <p style={{ fontSize: 12, color: '#71717a', margin: '0 0 16px' }}>
                Reference:{' '}
                <code style={{ fontFamily: 'ui-monospace, monospace' }}>
                  {error.digest}
                </code>
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
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
