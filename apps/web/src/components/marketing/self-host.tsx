import { Container, Database, HeartPulse, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CopyButton } from './copy-button';
import { DOCKER_HUB_URL, SectionHeader, Shell } from './primitives';

const QUICKSTART_LINES = [
  'mkdir tasknebula && cd tasknebula',
  'curl -fsSLo compose.yml https://raw.githubusercontent.com/neuraparse/tasknebula/main/docker-compose.desktop.yml',
  'docker compose up -d',
] as const;

const checklist: Array<{ icon: LucideIcon; tone: string; key: string }> = [
  {
    icon: Database,
    tone: 'blue',
    key: 'postgres',
  },
  {
    icon: Package,
    tone: 'violet',
    key: 'migrations',
  },
  {
    icon: HeartPulse,
    tone: 'emerald',
    key: 'health',
  },
  {
    icon: Container,
    tone: 'amber',
    key: 'pin',
  },
];

export function SelfHost() {
  const t = useTranslations('publicPages.landing.selfHost');

  return (
    <section id="self-host" className="border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <SectionHeader
              kicker={t('kicker')}
              kickerAccentVar="var(--landing-accent-cyan)"
              title={t('title')}
              description={t('description')}
              compact
            />
            <div className="stagger mt-8 grid gap-3 sm:grid-cols-2">
              {checklist.map(({ icon: Icon, tone, key }) => (
                <div
                  key={key}
                  className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-4"
                >
                  <div className={`icon-tile icon-tile-accent-${tone} h-9 w-9`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-[13px] font-[500] text-[var(--landing-text-dark)]">
                    {t(`cards.${key}.title`)}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-5 text-[var(--landing-text-subtle)]">
                    {t(`cards.${key}.body`)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-terminal overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--landing-border)] px-4 py-3">
              <span className="font-mono text-[11px] text-[var(--landing-text-subtle)]">
                {t('terminalTitle')}
              </span>
              <CopyButton text={QUICKSTART_LINES.join('\n')} label={t('copyQuickstart')} />
            </div>
            <pre
              tabIndex={0}
              role="region"
              aria-label={t('quickstartAria')}
              className="scrollbar-none overflow-x-auto p-4 font-mono text-[12px] leading-7 text-[var(--landing-text-body)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
            >
              <code>
                {QUICKSTART_LINES.map((line) => (
                  <span key={line} className="block">
                    <span className="select-none text-[var(--landing-text-muted)]">$ </span>
                    {line}
                  </span>
                ))}
              </code>
            </pre>
            <div className="border-t border-[var(--landing-border)] px-4 py-3">
              <p className="text-[12px] leading-5 text-[var(--landing-text-subtle)]">
                {t.rich('terminalNote', {
                  code: (chunks) => (
                    <span className="font-mono text-[var(--landing-text-body)]">{chunks}</span>
                  ),
                  imageLink: (chunks) => (
                    <a
                      href={DOCKER_HUB_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm text-[var(--landing-text-body)] underline decoration-[var(--landing-border-light)] underline-offset-2 transition-colors duration-150 hover:text-[var(--landing-text-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            </div>
          </div>
        </div>
      </Shell>
    </section>
  );
}
