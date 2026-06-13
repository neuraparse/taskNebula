import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bot, GitBranch, Inbox, Send } from 'lucide-react';
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
  return (
    <section id="workflow" className="dot-grid relative border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <SectionHeader
          kicker="The flow"
          kickerAccentVar="var(--landing-accent-violet)"
          title="One thread from intake to shipped."
          description="No tool-hopping between a tracker, a planning doc, and an agent console. The work moves through a single surface — humans and agents on the same timeline."
        />

        <ol className="stagger mt-12 space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
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
  title: string;
  body: string;
  visual: () => ReactNode;
};

const STEPS: Step[] = [
  {
    step: '01',
    icon: Inbox,
    tone: 'blue',
    title: 'Intake without the noise',
    body: 'Issues, requests, and inbound from your agents land in one queue. Triage suggests priority and labels so the backlog starts structured, not as a pile.',
    visual: IntakeVisual,
  },
  {
    step: '02',
    icon: GitBranch,
    tone: 'violet',
    title: 'Plan the sprint in place',
    body: 'Pull from the backlog into a sprint, set fix versions and components, and read scope at a glance. Planning lives next to the work, not in a separate doc.',
    visual: PlanVisual,
  },
  {
    step: '03',
    icon: Bot,
    tone: 'amber',
    title: 'Build alongside agents',
    body: 'Agents are first-class teammates over MCP — they pick up issues, comment, and open work the same way people do, with every action on the shared timeline.',
    visual: BuildVisual,
  },
  {
    step: '04',
    icon: Send,
    tone: 'emerald',
    title: 'Ship and track the outcome',
    body: 'Close issues with a real resolution, cut the version, and watch velocity and cycle time update live. Done means done — not a column you forgot to clear.',
    visual: ShipVisual,
  },
];

function StepRow({ step, reversed }: { step: Step; reversed: boolean }) {
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
            STEP {step.step}
          </span>
        </div>
        <h3 className="landing-title mt-5 text-[22px] text-[var(--landing-text-dark)] sm:text-[26px]">
          {step.title}
        </h3>
        <p className="landing-body mt-3 max-w-md text-[14px] text-[var(--landing-text-subtle)] sm:text-[15px]">
          {step.body}
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
  const rows = [
    { id: 'WEB-204', from: 'Inbound', chip: 'High', hue: 'chip-amber' },
    { id: 'API-88', from: 'Agent', chip: 'api', hue: 'chip-blue' },
    { id: 'WEB-205', from: 'Support', chip: 'bug', hue: 'chip-rose' },
  ] as const;
  return (
    <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
          Triage queue
        </span>
        <span className="text-[10px] tabular-nums text-[var(--landing-text-muted)]">3 new</span>
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
              <span className="text-[9px] text-[var(--landing-text-muted)]">{row.from}</span>
            </span>
            <span className={row.hue}>{row.chip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const planColumns = [
  { name: 'Backlog', accent: 'var(--landing-text-body)', cards: [70, 54] },
  { name: 'Sprint 5', accent: 'var(--landing-accent-violet)', cards: [62, 80, 46] },
] as const;

function PlanVisual() {
  return (
    <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
      <div className="grid grid-cols-2 gap-2">
        {planColumns.map((column) => (
          <div
            key={column.name}
            className="rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] p-2"
            style={{ borderTopColor: column.accent, borderTopWidth: 2 }}
          >
            <p className="mb-2 text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
              {column.name}
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
        <span className="chip-blue">checkout</span>
      </div>
    </div>
  );
}

function BuildVisual() {
  const events = [
    { who: 'Maya', kind: 'human', text: 'Picked up WEB-204', dot: 'var(--landing-accent-blue)' },
    {
      who: 'agent-rex',
      kind: 'agent',
      text: 'Opened PR · 4 files',
      dot: 'var(--landing-accent-amber)',
    },
    {
      who: 'agent-rex',
      kind: 'agent',
      text: 'Commented on API-88',
      dot: 'var(--landing-accent-amber)',
    },
  ] as const;
  return (
    <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="status-dot status-live" />
        <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
          Live activity
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
              {event.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const shipBars = [12, 16, 15, 19, 18, 24] as const;

function ShipVisual() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
        <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
          Velocity
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
          <span className="chip-emerald">Shipped</span>
        </div>
        <div className="mt-3 space-y-2">
          {[
            { label: 'Fixed', width: 84, color: 'var(--landing-accent-emerald)' },
            { label: "Won't do", width: 18, color: 'var(--landing-text-muted)' },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="w-14 text-[9px] text-[var(--landing-text-muted)]">{row.label}</span>
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
