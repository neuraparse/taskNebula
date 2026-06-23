import Link from 'next/link';
import { ArrowRight, Github, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CopyButton } from './copy-button';
import { GITHUB_URL, Kicker, Shell, primaryCtaClass, secondaryCtaClass } from './primitives';

const QUICKSTART_COMMAND = [
  'curl -fsSLo compose.yml https://raw.githubusercontent.com/neuraparse/tasknebula/main/docker-compose.desktop.yml',
  'docker compose up -d',
].join('\n');

const heroChips = ['cmdk', 'mcp', 'import', 'selfHost'] as const;

export function Hero() {
  const t = useTranslations('publicPages.landing.hero');

  return (
    <section className="relative overflow-hidden border-b border-[var(--landing-border)]">
      <div
        className="bg-aurora animate-aurora pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      <Shell className="relative py-20 sm:py-28">
        <div className="animate-blur-in max-w-4xl">
          <Kicker label={t('kicker')} accentVar="var(--landing-accent-blue)" />
          <h1 className="landing-display mt-7 max-w-4xl text-balance text-[44px] text-[var(--landing-text-dark)] sm:text-[64px] lg:text-[80px]">
            {t.rich('title', {
              accent: (chunks) => <span className="text-gradient-primary">{chunks}</span>,
            })}
          </h1>
          <p className="landing-body mt-6 max-w-2xl text-[16px] text-[var(--landing-text-subtle)] sm:text-[18px]">
            {t('description')}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/auth/signup" className={primaryCtaClass}>
              {t('createWorkspace')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryCtaClass}
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              {t('viewGithub')}
              <Star className="h-3.5 w-3.5 text-[var(--landing-accent-amber)]" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-6 flex max-w-2xl flex-col gap-2">
            <span className="landing-kicker text-[var(--landing-text-muted)]">
              {t('selfHostKicker')}
            </span>
            <div className="landing-terminal flex max-w-full items-center gap-3 py-2 pl-4 pr-2">
              <pre
                tabIndex={0}
                role="region"
                aria-label={t('quickstartAria')}
                className="scrollbar-none min-w-0 overflow-x-auto font-mono text-[11px] leading-5 text-[var(--landing-text-body)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
              >
                <code>
                  <span className="select-none text-[var(--landing-text-muted)]">$ </span>
                  curl -fsSLo compose.yml
                  https://raw.githubusercontent.com/neuraparse/tasknebula/main/docker-compose.desktop.yml
                  {'\n'}
                  <span className="select-none text-[var(--landing-text-muted)]">$ </span>
                  docker compose up -d
                </code>
              </pre>
              <CopyButton text={QUICKSTART_COMMAND} label={t('copyQuickstart')} />
            </div>
            <p className="text-[12px] text-[var(--landing-text-subtle)]">{t('selfHostMeta')}</p>
          </div>

          <div className="stagger mt-9 flex flex-wrap items-center gap-2">
            <span className="live-pill">{t('demoPill')}</span>
            {heroChips.map((chip) => (
              <span key={chip} className="chip-cyan">
                {t(`chips.${chip}`)}
              </span>
            ))}
          </div>
        </div>
      </Shell>
    </section>
  );
}
