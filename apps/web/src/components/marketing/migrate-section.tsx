import { GitBranch, Map, Shapes, Tags } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SectionHeader, Shell } from './primitives';

/**
 * "Migrate from Jira / Linear" — conversion section for switchers.
 *
 * Server-safe (no hooks). Composes the shared landing primitives so it inherits
 * the page's container rhythm, typography, and `--landing-*` tokens. Claims are
 * scoped to what actually ships: Jira/Linear issue + label imports exist today;
 * sprints and field mapping are part of the same importer surface.
 */
const steps: Array<{ icon: LucideIcon; tone: string; key: string }> = [
  {
    icon: GitBranch,
    tone: 'blue',
    key: 'issues',
  },
  {
    icon: Tags,
    tone: 'violet',
    key: 'labels',
  },
  {
    icon: Map,
    tone: 'cyan',
    key: 'fields',
  },
  {
    icon: Shapes,
    tone: 'emerald',
    key: 'workflow',
  },
];

export function MigrateSection() {
  const t = useTranslations('publicPages.landing.migrate');

  return (
    <section id="migrate" className="border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <SectionHeader
          kicker={t('kicker')}
          kickerAccentVar="var(--landing-accent-violet)"
          title={t('title')}
          description={t('description')}
          compact
        />

        <div className="stagger mt-10 grid gap-3 sm:grid-cols-2">
          {steps.map(({ icon: Icon, tone, key }) => (
            <div
              key={key}
              className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-5"
            >
              <div className={`icon-tile icon-tile-accent-${tone} h-9 w-9`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="mt-3 text-[14px] font-[500] text-[var(--landing-text-dark)]">
                {t(`steps.${key}.title`)}
              </p>
              <p className="mt-1.5 text-[13px] leading-6 text-[var(--landing-text-subtle)]">
                {t(`steps.${key}.body`)}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-2xl text-[13px] leading-6 text-[var(--landing-text-subtle)]">
          {t('note')}
        </p>
      </Shell>
    </section>
  );
}
