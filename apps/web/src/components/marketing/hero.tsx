import Link from 'next/link';
import { ArrowRight, Github, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GITHUB_URL, Kicker, Shell, primaryCtaClass, secondaryCtaClass } from './primitives';

export function Hero() {
  const t = useTranslations('publicPages.landing.hero');

  return (
    <section className="border-b border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-28">
        <div className="animate-fade-up max-w-4xl">
          <Kicker label={t('kicker')} accentVar="var(--landing-accent-blue)" />
          <h1 className="landing-display mt-7 max-w-4xl text-balance text-[44px] text-[var(--landing-text-dark)] sm:text-[64px] lg:text-[80px]">
            {t.rich('title', {
              accent: (chunks) => (
                <span className="text-[var(--landing-accent-blue)]">{chunks}</span>
              ),
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

          <p className="mt-6 max-w-2xl border-l border-[var(--landing-border-strong)] pl-4 text-[12px] leading-5 text-[var(--landing-text-subtle)]">
            {t('selfHostMeta')}
          </p>
        </div>
      </Shell>
    </section>
  );
}
