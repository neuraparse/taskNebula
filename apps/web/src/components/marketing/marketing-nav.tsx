import Link from 'next/link';
import { ArrowRight, Github } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TaskNebulaLogo } from '@/components/branding/tasknebula-logo';
import { MobileMenu } from './mobile-menu';
import { GITHUB_URL, Shell, focusRingClass } from './primitives';

const navItems = [
  { labelKey: 'features', href: '#features' },
  { labelKey: 'compare', href: '#compare' },
  { labelKey: 'selfHost', href: '#self-host' },
  { labelKey: 'faq', href: '#faq' },
] as const;

export function MarketingNav() {
  const t = useTranslations('publicPages.landing.nav');
  const items = navItems.map((item) => ({ ...item, label: t(`items.${item.labelKey}`) }));

  return (
    <nav
      aria-label={t('primaryAria')}
      className="sticky top-0 z-50 border-b border-[var(--landing-border)] bg-[color-mix(in_srgb,var(--landing-bg)_88%,transparent)] backdrop-blur-xl backdrop-saturate-150"
    >
      <Shell className="flex h-14 items-center justify-between gap-4">
        <Link
          href="/"
          className={`group flex items-center gap-2.5 rounded-md ${focusRingClass}`}
          aria-label={t('homeAria')}
        >
          <TaskNebulaLogo
            compact
            variant="mono"
            className="ease-snap shrink-0 text-[var(--landing-accent-blue)] transition-transform duration-200 group-hover:-translate-y-0.5"
          />
          <span className="landing-title text-[15px] text-[var(--landing-text-dark)]">
            TaskNebula
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 rounded-md border border-transparent px-1 lg:flex">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-1.5 text-[13px] text-[var(--landing-text-subtle)] transition-colors duration-150 hover:bg-[var(--landing-bg-elevated)] hover:text-[var(--landing-text-dark)] ${focusRingClass}`}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('githubAria')}
            className={`ease-snap inline-flex h-[34px] items-center gap-2 rounded-md border border-[var(--landing-border-strong)] px-3 text-[13px] font-[430] text-[var(--landing-text)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--landing-bg-elevated)] ${focusRingClass}`}
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('github')}</span>
          </a>
          <Link
            href="/auth/signin"
            className={`hidden h-[34px] items-center rounded-md px-3 text-[13px] font-[430] text-[var(--landing-text-subtle)] transition-colors duration-150 hover:text-[var(--landing-text-dark)] md:inline-flex ${focusRingClass}`}
          >
            {t('signIn')}
          </Link>
          <Link
            href="/auth/signup"
            className={`ease-snap group inline-flex h-[34px] items-center gap-1.5 rounded-md bg-[var(--landing-accent-blue)] px-3 text-[13px] font-[450] text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--landing-accent-blue-hover)] ${focusRingClass}`}
          >
            {t('startFree')}
            <ArrowRight
              className="ease-snap h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <MobileMenu items={items} />
        </div>
      </Shell>
    </nav>
  );
}
