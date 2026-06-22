import Link from 'next/link';
import type { ReactNode } from 'react';
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
  return (
    <main className="auth-carbon-ui relative min-h-dvh overflow-x-hidden">
      <div aria-hidden="true" className="auth-carbon-grid absolute inset-0" />

      <div className="relative z-10 flex min-h-dvh items-stretch justify-center p-0 sm:p-6 lg:p-8">
        <section className="grid min-h-dvh w-full max-w-6xl border-x border-[#c6c6c6] bg-white sm:min-h-[min(760px,calc(100dvh-3rem))] sm:border md:grid-cols-[minmax(0,1fr)_minmax(384px,440px)]">
          <aside className="auth-carbon-visual hidden min-h-full overflow-hidden bg-[#161616] text-white md:flex md:flex-col">
            <div className="p-8">
              <BrandLink tone="dark" />
            </div>

            <div aria-hidden="true" className="relative mt-auto h-[68%] min-h-96">
              <div className="absolute inset-x-0 top-8 h-px bg-[#393939]" />
              <div className="absolute bottom-0 left-0 grid h-72 w-72 grid-cols-6 grid-rows-6">
                {Array.from({ length: 36 }).map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      'border-r border-t border-[#393939]',
                      index === 7 || index === 14 || index === 21 || index === 28
                        ? 'bg-[#0f62fe]'
                        : 'bg-transparent'
                    )}
                  />
                ))}
              </div>
              <div className="absolute bottom-20 right-10 h-32 w-32 border border-[#525252]" />
              <div className="absolute bottom-8 right-24 h-20 w-20 bg-[#0f62fe]" />
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
          ? 'text-white focus-visible:outline-white'
          : 'text-[#161616] focus-visible:outline-[#0f62fe]'
      )}
      aria-label={APP_NAME}
    >
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center text-xs font-semibold',
          isDark ? 'bg-white text-[#161616]' : 'bg-[#161616] text-white'
        )}
        aria-hidden="true"
      >
        {BRAND_INITIALS}
      </span>
      <span>{APP_NAME}</span>
    </Link>
  );
}
