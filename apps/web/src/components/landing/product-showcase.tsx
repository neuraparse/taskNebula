import {
  Bot,
  CheckCircle2,
  CircleDot,
  GitCommitHorizontal,
  GitPullRequest,
  ShieldCheck,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TaskNebulaLogo } from '@/components/branding/tasknebula-logo';
import { SectionHeader, Shell } from '@/components/marketing/primitives';

/**
 * A product proof, not a fake application.
 *
 * The landing used to ship an in-memory drag-and-drop board that looked
 * interactive but could not persist a real action. This static evidence ledger
 * tells the more useful TaskNebula story: one issue keeps its context as it
 * moves through planning, agent work, human review, and a release.
 */
export function HeroShowcase() {
  const showcase = useTranslations('publicPages.landing.showcase');
  const workflow = useTranslations('publicPages.landing.workflow');
  const ai = useTranslations('publicPages.landing.aiMcp');

  const topology = [
    {
      id: 'issue',
      step: '01',
      label: showcase('board.issues.web18.title'),
      state: showcase('board.columns.backlog'),
      icon: CircleDot,
    },
    {
      id: 'plan',
      step: '02',
      label: workflow('steps.plan.title'),
      state: showcase('board.columns.todo'),
      icon: GitCommitHorizontal,
    },
    {
      id: 'agent',
      step: '03',
      label: workflow('steps.build.title'),
      state: ai('capabilities.mcp.title'),
      icon: Bot,
    },
    {
      id: 'review',
      step: '04',
      label: showcase('workflow.rules.reviewApproved'),
      state: showcase('board.columns.inReview'),
      icon: ShieldCheck,
    },
    {
      id: 'release',
      step: '05',
      label: workflow('steps.ship.title'),
      state: workflow('visuals.ship.shipped'),
      icon: GitPullRequest,
    },
  ] as const;

  const reviewItems = [
    showcase('board.issues.web18.checklist.first'),
    showcase('board.issues.web18.checklist.second'),
    showcase('board.issues.web18.checklist.third'),
  ] as const;

  const activity = [
    {
      id: 'agent-pr',
      actor: ai('mock.agent'),
      detail: workflow('visuals.build.events.openedPr'),
      time: showcase('team.times.fourMinutes'),
      agent: true,
    },
    {
      id: 'human-review',
      actor: 'SK',
      detail: showcase('team.activityItems.moved'),
      time: showcase('team.times.now'),
      agent: false,
    },
  ] as const;

  return (
    <section
      id="board"
      aria-labelledby="work-topology-title"
      className="border-b border-[var(--landing-border)] bg-[var(--landing-bg)]"
    >
      <Shell className="py-20 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-end lg:gap-16">
          <SectionHeader
            kicker={showcase('board.kicker')}
            kickerAccentVar="var(--landing-accent-blue)"
            title={showcase('board.title')}
            description={showcase('board.description')}
          />
          <p className="landing-body max-w-lg border-l border-[var(--landing-border-strong)] pl-4 text-[13px] text-[var(--landing-text-subtle)] sm:text-[14px]">
            {workflow('description')}
          </p>
        </div>

        <figure className="animate-blur-in shadow-xs mt-10 overflow-hidden rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)] sm:mt-12">
          <div className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--landing-border)] px-3 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <TaskNebulaLogo
                compact
                variant="mono"
                className="shrink-0 text-[var(--landing-accent-blue)]"
              />
              <div className="min-w-0">
                <p
                  id="work-topology-title"
                  className="truncate text-[12px] font-[500] text-[var(--landing-text-dark)]"
                >
                  TaskNebula {showcase('frame.board')}
                </p>
                <p className="truncate text-[10px] text-[var(--landing-text-subtle)]">
                  {showcase('frame.preview')}
                </p>
              </div>
            </div>
            <span className="hidden rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-3 py-1 font-mono text-[10px] text-[var(--landing-text-muted)] sm:inline-flex">
              {showcase('frame.boardUrl', { board: showcase('board.boards.website') })}
            </span>
          </div>

          <div className="grid lg:grid-cols-[minmax(14rem,0.48fr)_minmax(0,1.52fr)]">
            <div className="border-b border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <p className="landing-kicker text-[var(--landing-text-subtle)]">
                {workflow('kicker')}
              </p>
              <ol className="mt-5" aria-label={workflow('title')}>
                {topology.map(({ id, step, label, state, icon: Icon }, index) => (
                  <li
                    key={id}
                    className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0"
                  >
                    <div className="relative flex justify-center">
                      <span
                        className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-sm border bg-[var(--landing-bg-card)] font-mono text-[9px] tabular-nums ${
                          index === topology.length - 1
                            ? 'border-[var(--landing-accent-blue)] text-[var(--landing-accent-blue)]'
                            : 'border-[var(--landing-border-strong)] text-[var(--landing-text-muted)]'
                        }`}
                        aria-hidden="true"
                      >
                        {step}
                      </span>
                      {index < topology.length - 1 ? (
                        <span
                          className="absolute bottom-[-1.25rem] top-7 border-l border-[var(--landing-border-strong)]"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <div className="flex items-start gap-2">
                        <Icon
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--landing-text-muted)]"
                          aria-hidden="true"
                        />
                        <p className="text-[12px] font-[500] leading-5 text-[var(--landing-text-dark)]">
                          {label}
                        </p>
                      </div>
                      <p className="mt-0.5 pl-[1.375rem] text-[10px] leading-4 text-[var(--landing-text-subtle)]">
                        {state}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="min-w-0">
              <div className="grid min-w-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.65fr)]">
                <article className="min-w-0 p-4 sm:p-6 xl:border-r xl:border-[var(--landing-border)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CircleDot
                        className="h-4 w-4 text-[var(--landing-accent-blue)]"
                        aria-hidden="true"
                      />
                      <span className="font-mono text-[11px] text-[var(--landing-text-body)]">
                        WEB-18
                      </span>
                    </div>
                    <span className="rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] px-2 py-1 text-[10px] text-[var(--landing-text-subtle)]">
                      {showcase('board.priorities.high')}
                    </span>
                  </div>

                  <h3 className="mt-5 max-w-xl text-balance text-[24px] font-[500] leading-tight text-[var(--landing-text-dark)] sm:text-[30px]">
                    {showcase('board.issues.web18.title')}
                  </h3>
                  <p className="mt-3 max-w-2xl text-[13px] leading-6 text-[var(--landing-text-subtle)] sm:text-[14px]">
                    {showcase('board.issues.web18.summary')}
                  </p>

                  <dl className="mt-6 grid border-y border-[var(--landing-border)] sm:grid-cols-3">
                    <div className="py-3 sm:pr-4">
                      <dt className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-subtle)]">
                        {showcase('board.columns.inReview')}
                      </dt>
                      <dd className="mt-1 text-[11px] text-[var(--landing-text-dark)]">
                        {showcase('workflow.rules.reviewApproved')}
                      </dd>
                    </div>
                    <div className="border-t border-[var(--landing-border)] py-3 sm:border-l sm:border-t-0 sm:px-4">
                      <dt className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-subtle)]">
                        {showcase('team.members')}
                      </dt>
                      <dd className="mt-1 font-mono text-[11px] text-[var(--landing-text-dark)]">
                        SK
                      </dd>
                    </div>
                    <div className="border-t border-[var(--landing-border)] py-3 sm:border-l sm:border-t-0 sm:pl-4">
                      <dt className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-subtle)]">
                        {showcase('workflow.transitionRules')}
                      </dt>
                      <dd className="mt-1 text-[11px] text-[var(--landing-text-dark)]">
                        {showcase('workflow.rules.subtasksComplete')}
                      </dd>
                    </div>
                  </dl>

                  <section aria-labelledby="review-evidence-title" className="mt-6">
                    <h4
                      id="review-evidence-title"
                      className="text-[10px] font-[500] uppercase tracking-[0.14em] text-[var(--landing-text-subtle)]"
                    >
                      {showcase('board.checklist')}
                    </h4>
                    <ul className="mt-3 space-y-2.5">
                      {reviewItems.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 text-[12px] leading-5 text-[var(--landing-text-body)]"
                        >
                          <CheckCircle2
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--landing-accent-blue)]"
                            aria-hidden="true"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </article>

                <aside
                  aria-labelledby="activity-ledger-title"
                  className="border-t border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-4 sm:p-6 xl:border-t-0"
                >
                  <h3
                    id="activity-ledger-title"
                    className="text-[10px] font-[500] uppercase tracking-[0.14em] text-[var(--landing-text-subtle)]"
                  >
                    {workflow('visuals.build.title')}
                  </h3>

                  <ol className="mt-4 border-t border-[var(--landing-border)]">
                    {activity.map((entry) => (
                      <li
                        key={entry.id}
                        className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[var(--landing-border)] py-4"
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-sm border font-mono text-[8px] ${
                            entry.agent
                              ? 'border-[var(--landing-accent-blue)] text-[var(--landing-accent-blue)]'
                              : 'border-[var(--landing-border-strong)] bg-[var(--landing-bg-card)] text-[var(--landing-text-body)]'
                          }`}
                        >
                          {entry.agent ? (
                            <>
                              <span className="sr-only">{entry.actor}</span>
                              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                            </>
                          ) : (
                            entry.actor
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[11px] leading-5 text-[var(--landing-text-dark)]">
                            {entry.detail}
                          </span>
                          <span className="mt-0.5 block font-mono text-[9px] text-[var(--landing-text-subtle)]">
                            {entry.time}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-6 border-l-2 border-[var(--landing-accent-blue)] pl-3">
                    <p className="font-mono text-[10px] text-[var(--landing-text-subtle)]">
                      v1.4.0
                    </p>
                    <p className="mt-1 text-[13px] font-[500] text-[var(--landing-text-dark)]">
                      {workflow('visuals.ship.shipped')}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--landing-text-subtle)]">
                      {workflow('visuals.ship.resolution.fixed')}
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </div>

          <figcaption className="border-t border-[var(--landing-border)] px-4 py-3 text-[10px] leading-5 text-[var(--landing-text-subtle)] sm:px-6">
            {workflow('steps.ship.body')}
          </figcaption>
        </figure>
      </Shell>
    </section>
  );
}

export function ProductShowcase() {
  return <HeroShowcase />;
}
