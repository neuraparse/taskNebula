import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GITHUB_URL, SectionHeader, Shell } from './primitives';

/**
 * FAQ — native <details>/<summary> so it works with JavaScript disabled. The
 * localized strings also feed the FAQPage JSON-LD emitted below.
 */
const faqItemKeys = [
  'freeMit',
  'selfHost',
  'aiKeys',
  'aiReality',
  'mcpServer',
  'imports',
  'productionReady',
  'dataVisibility',
] as const;

export function Faq() {
  const t = useTranslations('publicPages.landing.faq');
  const faqItems = faqItemKeys.map((key) => ({
    key,
    question: t(`items.${key}.question`),
    answer: t(`items.${key}.answer`),
  }));

  return (
    <section id="faq" className="border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <SectionHeader
          kicker={t('kicker')}
          kickerAccentVar="var(--landing-accent-violet)"
          title={t('title')}
          description={t('description')}
          compact
        />

        <div className="mt-10 max-w-3xl divide-y divide-[var(--landing-border)] rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)]">
          {faqItems.map((item) => (
            <details key={item.key} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-[15px] font-[440] text-[var(--landing-text-dark)] transition-colors duration-150 hover:bg-[var(--landing-bg-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)] [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  className="ease-snap h-4 w-4 shrink-0 text-[var(--landing-text-muted)] transition-transform duration-150 group-open:rotate-90"
                  aria-hidden="true"
                />
                {item.question}
              </summary>
              <p className="landing-body px-5 pb-5 pl-12 text-[14px] text-[var(--landing-text-subtle)]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <p className="landing-body mt-6 max-w-3xl text-[13px] text-[var(--landing-text-muted)]">
          {t.rich('statusPrompt', {
            link: (chunks) => (
              <a
                href={`${GITHUB_URL}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-[var(--landing-text-body)] underline decoration-[var(--landing-border-light)] underline-offset-2 transition-colors duration-150 hover:text-[var(--landing-text-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </Shell>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }),
        }}
      />
    </section>
  );
}
