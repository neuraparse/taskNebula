import Link from 'next/link';
import { ArrowRight, Github } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GITHUB_URL, Kicker, Shell, primaryCtaClass, secondaryCtaClass } from './primitives';

export function FinalCta() {
  const t = useTranslations('publicPages.landing.finalCta');

  return (
    <section className="border-t border-[var(--landing-border)] bg-[var(--landing-bg-elevated)]">
      <Shell className="py-16 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <Kicker label={t('kicker')} accentVar="var(--landing-accent-emerald)" />
            <h2 className="landing-display mt-6 text-balance text-[36px] text-[var(--landing-text-dark)] sm:text-[48px] lg:text-[56px]">
              {t.rich('title', {
                accent: (chunks) => (
                  <span className="text-[var(--landing-accent-blue)]">{chunks}</span>
                ),
              })}
            </h2>
            <p className="landing-body mt-5 max-w-xl text-[15px] text-[var(--landing-text-subtle)]">
              {t('description')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
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
              {t('readSource')}
            </a>
          </div>
        </div>
      </Shell>
    </section>
  );
}
