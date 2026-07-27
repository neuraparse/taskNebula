import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface AuthShellProps {
  children: ReactNode;
  contentClassName?: string;
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'TaskNebula';
const BRAND_INITIALS =
  APP_NAME.match(/\b[\p{L}\p{N}]/gu)
    ?.join('')
    .slice(0, 2)
    .toUpperCase() || 'TN';

export function AuthShell({ children, contentClassName }: AuthShellProps) {
  const t = useTranslations('publicPages.landing.proof');

  return (
    <main className="auth-carbon-ui relative min-h-dvh overflow-x-hidden">
      <div className="flex min-h-dvh items-stretch justify-center p-0 sm:p-6 lg:p-8">
        <section className="grid min-h-dvh w-full max-w-6xl border-x border-[var(--auth-border)] bg-[var(--auth-surface)] sm:min-h-[min(760px,calc(100dvh-3rem))] sm:border md:grid-cols-2">
          <aside className="hidden min-h-full bg-[var(--auth-text)] text-[var(--auth-surface)] md:flex md:flex-col">
            <div className="p-8 lg:p-10">
              <BrandLink tone="dark" />
            </div>

            <div className="mt-auto p-8 lg:p-10">
              <div className="border-t border-[var(--auth-text-muted)] pt-6">
                <p className="max-w-md text-2xl font-normal leading-tight tracking-tight">
                  {t('headline')}
                </p>
                <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--auth-border)]">
                  {t('subline')}
                </p>
              </div>

              <ul className="mt-8 border-b border-[var(--auth-text-muted)] text-sm">
                <li className="border-t border-[var(--auth-text-muted)]">
                  <a
                    href="https://github.com/neuraparse/tasknebula"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-3 text-[var(--auth-surface)] transition-colors duration-150 hover:text-[var(--auth-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-blue)]"
                  >
                    {t('items.sourceGithub')}
                  </a>
                </li>
                <li className="border-t border-[var(--auth-text-muted)]">
                  <a
                    href="https://github.com/neuraparse/tasknebula/blob/main/LICENSE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-3 text-[var(--auth-surface)] transition-colors duration-150 hover:text-[var(--auth-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-blue)]"
                  >
                    {t('items.mitLicensed')}
                  </a>
                </li>
                <li className="border-t border-[var(--auth-text-muted)]">
                  <a
                    href="/openapi.json"
                    className="block py-3 text-[var(--auth-surface)] transition-colors duration-150 hover:text-[var(--auth-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-blue)]"
                  >
                    {t('items.openapiSpec')}
                  </a>
                </li>
              </ul>
            </div>
          </aside>

          <div
            className={cn(
              'flex min-h-dvh flex-col justify-start overflow-y-auto px-5 pb-8 pt-10 sm:min-h-0 sm:justify-center sm:px-10 sm:py-8 md:px-12',
              contentClassName
            )}
          >
            <div className="mb-10 md:hidden">
              <BrandLink />
            </div>
            <div className="w-full max-w-[392px]">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandLink({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const isDark = tone === 'dark';

  return (
    <Link
      href="/"
      className={cn(
        'inline-flex items-center gap-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        isDark
          ? 'text-[var(--auth-surface)] focus-visible:outline-[var(--auth-surface)]'
          : 'text-[var(--auth-text)] focus-visible:outline-[var(--auth-blue)]'
      )}
      aria-label={APP_NAME}
    >
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center text-xs font-semibold',
          isDark
            ? 'bg-[var(--auth-surface)] text-[var(--auth-text)]'
            : 'bg-[var(--auth-text)] text-[var(--auth-surface)]'
        )}
        aria-hidden="true"
      >
        {BRAND_INITIALS}
      </span>
      <span>{APP_NAME}</span>
    </Link>
  );
}
