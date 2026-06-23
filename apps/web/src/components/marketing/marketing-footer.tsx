import { TaskNebulaLogo } from '@/components/branding/tasknebula-logo';
import { Github } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DOCKER_HUB_URL, GITHUB_URL, Shell, focusRingClass } from './primitives';

type FooterLink = { labelKey: string; href: string; ext?: boolean };

const columns: Array<{ titleKey: string; links: FooterLink[] }> = [
  {
    titleKey: 'product',
    links: [
      { labelKey: 'features', href: '#features' },
      { labelKey: 'compare', href: '#compare' },
      { labelKey: 'selfHost', href: '#self-host' },
      { labelKey: 'faq', href: '#faq' },
    ],
  },
  {
    titleKey: 'resources',
    links: [
      { labelKey: 'openapiSpec', href: '/openapi.json' },
      { labelKey: 'mcpServer', href: `${GITHUB_URL}/tree/main/packages/mcp-server`, ext: true },
      { labelKey: 'dockerHub', href: DOCKER_HUB_URL, ext: true },
      { labelKey: 'healthEndpoint', href: '/api/health' },
    ],
  },
  {
    titleKey: 'openSource',
    links: [
      { labelKey: 'github', href: GITHUB_URL, ext: true },
      { labelKey: 'changelog', href: `${GITHUB_URL}/blob/main/CHANGELOG.md`, ext: true },
      { labelKey: 'reportBug', href: `${GITHUB_URL}/issues`, ext: true },
      { labelKey: 'contributing', href: `${GITHUB_URL}/blob/main/CONTRIBUTING.md`, ext: true },
    ],
  },
  {
    titleKey: 'legal',
    links: [
      { labelKey: 'mitLicense', href: `${GITHUB_URL}/blob/main/LICENSE`, ext: true },
      { labelKey: 'signIn', href: '/auth/signin' },
      { labelKey: 'createWorkspace', href: '/auth/signup' },
    ],
  },
];

export function MarketingFooter() {
  const t = useTranslations('publicPages.landing.footer');

  return (
    <footer className="border-t border-[var(--landing-border)]">
      <Shell className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
          <div className="max-w-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <TaskNebulaLogo variant="mono" className="text-[var(--landing-accent-blue)]" />
              <div>
                <p className="landing-title text-[15px] text-[var(--landing-text-dark)]">
                  TaskNebula
                </p>
                <p className="text-[11px] text-[var(--landing-text-subtle)]">{t('tagline')}</p>
              </div>
            </div>
            <p className="mt-5 text-[12px] leading-5 text-[var(--landing-text-subtle)]">
              {t('description')}
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('githubAria')}
              className={`ease-snap mt-5 inline-flex h-[34px] items-center gap-2 rounded-md border border-[var(--landing-border-strong)] px-3 text-[12px] font-[430] text-[var(--landing-text)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--landing-bg-elevated)] ${focusRingClass}`}
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              {t('starGithub')}
            </a>
          </div>

          {columns.map((column) => (
            <div key={column.titleKey}>
              <h3 className="landing-kicker text-[var(--landing-text-subtle)]">
                {t(`columns.${column.titleKey}`)}
              </h3>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.labelKey}>
                    <a
                      href={link.href}
                      {...(link.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className={`rounded-sm text-[13px] text-[var(--landing-text-subtle)] transition-colors duration-150 hover:text-[var(--landing-text-dark)] ${focusRingClass}`}
                    >
                      {t(`links.${link.labelKey}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--landing-border)] pt-6 text-[12px] text-[var(--landing-text-subtle)]">
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
          <span>{t('trademarks')}</span>
        </div>
      </Shell>
    </footer>
  );
}
