import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bot, GitBranch, Inbox, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SectionHeader, Shell } from './primitives';

type Tone = 'blue' | 'violet' | 'amber' | 'emerald';

/**
 * WorkflowNarrative — tells the product story as a single delivery flow:
 * Intake → Plan → Build with agents → Ship & track. Each step pairs tight copy
 * with a CSS-only mini UI mock (no images). Rows alternate left/right on desktop
 * and stay stacked on mobile. Decorative visuals are aria-hidden.
 *
 * Server-safe: no hooks, no state. Colors flow through the `--landing-*` tokens
 * scoped by `.landing-dark`, matching the other landing sections.
 */
export function WorkflowNarrative() {
  const t = useTranslations('publicPages.landing.workflow');

  return (
    <section id="workflow" className="dot-grid relative border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <SectionHeader
          kicker={t('kicker')}
          kickerAccentVar="var(--landing-accent-violet)"
          title={t('title')}
          description={t('description')}
        />

        <ol className="stagger mt-12 space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.key}>
              <StepRow step={step} reversed={index % 2 === 1} />
            </li>
          ))}
        </ol>
      </Shell>
    </section>
  );
}

type Step = {
  step: string;
  icon: LucideIcon;
  tone: Tone;
  key: string;
  visual: () => ReactNode;
};

const STEPS: Step[] = [
  {
    step: '01',
    icon: Inbox,
    tone: 'blue',
    key: 'intake',
    visual: IntakeVisual,
  },
  {
    step: '02',
    icon: GitBranch,
    tone: 'violet',
    key: 'plan',
    visual: PlanVisual,
  },
  {
    step: '03',
    icon: Bot,
    tone: 'amber',
    key: 'build',
    visual: BuildVisual,
  },
  {
    step: '04',
    icon: Send,
    tone: 'emerald',
    key: 'ship',
    visual: ShipVisual,
  },
];

function StepRow({ step, reversed }: { step: Step; reversed: boolean }) {
  const t = useTranslations('publicPages.landing.workflow');
  const Icon = step.icon;
  const Visual = step.visual;
  return (
    <article
      className={`ease-smooth grid items-center gap-6 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-8 lg:grid-cols-2 lg:gap-12 ${
        reversed ? 'lg:[&>*:first-child]:order-2' : ''
      }`}
    >
      <div>
        <div className="flex items-center gap-3">
          <div className={`icon-tile icon-tile-accent-${step.tone} h-10 w-10`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="font-mono text-[12px] tracking-[0.18em] text-[var(--landing-text-muted)]">
            {t('stepLabel', { step: step.step })}
          </span>
        </div>
        <h3 className="landing-title mt-5 text-[22px] text-[var(--landing-text-dark)] sm:text-[26px]">
          {t(`steps.${step.key}.title`)}
        </h3>
        <p className="landing-body mt-3 max-w-md text-[14px] text-[var(--landing-text-subtle)] sm:text-[15px]">
          {t(`steps.${step.key}.body`)}
        </p>
      </div>
      <div aria-hidden="true">
        <Visual />
      </div>
    </article>
  );
}

/* ----------------------------------------------------------------------------
   CSS-only mini mocks — decorative, pure DOM, no images (aria-hidden above)
   ---------------------------------------------------------------------------- */

function IntakeVisual() {
  const t = useTranslations('publicPages.landing.workflow.visuals.intake');
  const rows = [
    { id: 'WEB-204', fromKey: 'inbound', chipKey: 'high', hue: 'chip-amber' },
    { id: 'API-88', fromKey: 'agent', chipKey: 'api', hue: 'chip-blue' },
    { id: 'WEB-205', fromKey: 'support', chipKey: 'bug', hue: 'chip-rose' },
  ] as const;
  return (
    <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
          {t('title')}
        </span>
        <span className="text-[10px] tabular-nums text-[var(--landing-text-muted)]">
          {t('newCount')}
        </span>
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-2 rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-2.5 py-1.5"
          >
            <span className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[var(--landing-text-body)]">
                {row.id}
              </span>
              <span className="text-[9px] text-[var(--landing-text-muted)]">
                {t(`sources.${row.fromKey}`)}
              </span>
            </span>
            <span className={row.hue}>{t(`chips.${row.chipKey}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const planColumns = [
  { key: 'backlog', accent: 'var(--landing-text-body)', cards: [70, 54] },
  { key: 'sprint5', accent: 'var(--landing-accent-violet)', cards: [62, 80, 46] },
] as const;

function PlanVisual() {
  const t = useTranslations('publicPages.landing.workflow.visuals.plan');
  return (
    <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
      <div className="grid grid-cols-2 gap-2">
        {planColumns.map((column) => (
          <div
            key={column.key}
            className="rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] p-2"
            style={{ borderTopColor: column.accent, borderTopWidth: 2 }}
          >
            <p className="mb-2 text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
              {t(`columns.${column.key}`)}
            </p>
            <div className="space-y-1.5">
              {column.cards.map((width, index) => (
                <div
                  key={index}
                  className="rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-1.5"
                >
                  <div
                    className="h-1.5 rounded-full bg-[var(--landing-border-light)]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="chip-violet">v1.4.0</span>
        <span className="chip-blue">{t('checkout')}</span>
      </div>
    </div>
  );
}

function BuildVisual() {
  const t = useTranslations('publicPages.landing.workflow.visuals.build');
  const events = [
    { who: 'Maya', kind: 'human', textKey: 'pickedUp', dot: 'var(--landing-accent-blue)' },
    {
      who: 'agent-rex',
      kind: 'agent',
      textKey: 'openedPr',
      dot: 'var(--landing-accent-amber)',
    },
    {
      who: 'agent-rex',
      kind: 'agent',
      textKey: 'commented',
      dot: 'var(--landing-accent-amber)',
    },
  ] as const;
  return (
    <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="status-dot status-live" />
        <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
          {t('title')}
        </span>
      </div>
      <div className="space-y-1.5">
        {events.map((event, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-2.5 py-1.5"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: event.dot }}
            />
            <span className="font-mono text-[10px] text-[var(--landing-text-body)]">
              {event.who}
            </span>
            {event.kind === 'agent' ? <span className="chip-amber">MCP</span> : null}
            <span className="truncate text-[10px] text-[var(--landing-text-muted)]">
              {t(`events.${event.textKey}`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const shipBars = [12, 16, 15, 19, 18, 24] as const;

function ShipVisual() {
  const t = useTranslations('publicPages.landing.workflow.visuals.ship');

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
        <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
          {t('velocity')}
        </p>
        <div className="mt-2 flex h-[52px] items-end gap-1.5">
          {shipBars.map((value, index) => (
            <div
              key={index}
              className="flex-1 rounded-t"
              style={{
                height: `${(value / 25) * 100}%`,
                backgroundColor:
                  index === shipBars.length - 1
                    ? 'var(--landing-accent-emerald)'
                    : 'color-mix(in srgb, var(--landing-accent-emerald) 30%, transparent)',
              }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-[var(--landing-text-dark)]">v1.4.0</span>
          <span className="chip-emerald">{t('shipped')}</span>
        </div>
        <div className="mt-3 space-y-2">
          {[
            { labelKey: 'fixed', width: 84, color: 'var(--landing-accent-emerald)' },
            { labelKey: 'wontDo', width: 18, color: 'var(--landing-text-muted)' },
          ].map((row) => (
            <div key={row.labelKey} className="flex items-center gap-2">
              <span className="w-14 text-[9px] text-[var(--landing-text-muted)]">
                {t(`resolution.${row.labelKey}`)}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--landing-bg)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${row.width}%`, backgroundColor: row.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
