import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { TaskNebulaLogo } from '@/components/branding/tasknebula-logo';

/**
 * Layout for public-facing pages (no auth required). Keeps the document
 * chrome minimal — no sidebars, no command palette, no AI provider.
 *
 * Routes that mount here must also be allow-listed in middleware.ts.
 */

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const tLanding = useTranslations('publicPages.landing.nav');
  const tPublic = useTranslations('publicPages');
  const tAi = useTranslations('aiModelCards');

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label={tLanding('homeAria')}
            className="focus-visible:ring-ring inline-flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2"
          >
            <TaskNebulaLogo compact className="text-primary h-6 w-6" />
          </Link>

          <nav aria-label={tLanding('primaryAria')}>
            <ul className="text-muted-foreground flex items-center gap-1 text-xs">
              <li>
                <Link
                  href="/trust"
                  className="hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex h-8 items-center rounded-md px-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                >
                  {tPublic('trustEyebrow')}
                </Link>
              </li>
              <li>
                <Link
                  href="/ai-model-cards"
                  className="hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex h-8 items-center rounded-md px-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                >
                  {tAi('title')}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
