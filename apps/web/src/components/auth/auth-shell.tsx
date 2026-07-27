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
    <main className="bg-muted/30 text-foreground relative min-h-dvh overflow-x-hidden">
      <div className="mx-auto flex min-h-dvh max-w-7xl items-stretch justify-center md:p-8">
        <section className="border-border bg-background grid min-h-dvh w-full overflow-hidden border-x md:min-h-[min(760px,calc(100dvh-4rem))] md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:rounded-lg md:border">
          <aside className="border-border bg-muted/40 hidden min-h-full flex-col border-e md:flex">
            <div className="p-8 lg:p-10">
              <BrandLink />
            </div>

            <div className="mt-auto p-8 lg:p-10">
              <div className="border-border border-t pt-6">
                <p className="text-foreground max-w-md text-2xl font-semibold leading-tight tracking-tight">
                  {t('headline')}
                </p>
                <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-6">
                  {t('subline')}
                </p>
              </div>

              <ul className="divide-border border-border mt-8 divide-y border-y text-sm">
                <li>
                  <a
                    href="https://github.com/neuraparse/tasknebula"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-primary focus-visible:ring-ring focus-visible:ring-offset-muted block rounded-sm py-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    {t('items.sourceGithub')}
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/neuraparse/tasknebula/blob/main/LICENSE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-primary focus-visible:ring-ring focus-visible:ring-offset-muted block rounded-sm py-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    {t('items.mitLicensed')}
                  </a>
                </li>
                <li>
                  <a
                    href="/openapi.json"
                    className="text-foreground hover:text-primary focus-visible:ring-ring focus-visible:ring-offset-muted block rounded-sm py-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    {t('items.openapiSpec')}
                  </a>
                </li>
              </ul>
            </div>
          </aside>

          <div
            className={cn(
              'bg-background flex min-h-dvh flex-col justify-start overflow-y-auto px-5 pb-8 pt-7 sm:min-h-0 sm:justify-center sm:px-10 sm:py-10 md:px-12 lg:px-16',
              contentClassName
            )}
          >
            <div className="mb-12 md:hidden">
              <BrandLink />
            </div>
            <div className="w-full max-w-[400px] self-center">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandLink() {
  return (
    <Link
      href="/"
      className="text-foreground hover:text-primary focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-11 max-w-full items-center gap-3 rounded-sm text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      aria-label={APP_NAME}
    >
      <span
        className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
        aria-hidden="true"
      >
        {BRAND_INITIALS}
      </span>
      <span className="truncate">{APP_NAME}</span>
    </Link>
  );
}
