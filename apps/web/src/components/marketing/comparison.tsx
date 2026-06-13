import type { ReactNode } from 'react';

import { SectionHeader, Shell } from './primitives';

/**
 * Honest 4-way comparison built to convert switchers from Jira / Linear / Plane.
 *
 * Every cell is a verifiable, public claim — vendor facts reflect public docs
 * and pricing pages as of June 2026 (see footnote). TaskNebula's own column uses
 * `yes | partial | no` markers (icon + text, never color alone) so the table is
 * readable for screen readers and color-blind users. We intentionally do NOT
 * mark anything still in flight as done (e.g. OAuth/SSO, row-level security).
 */

type Mark = 'yes' | 'partial' | 'no';

type Cell = { mark: Mark; note: string };

type Row = {
  feature: string;
  tasknebula: Cell;
  jira: Cell;
  linear: Cell;
  plane: Cell;
};

const rows: readonly Row[] = [
  {
    feature: 'Open source (MIT)',
    tasknebula: { mark: 'yes', note: 'Entire codebase, MIT' },
    jira: { mark: 'no', note: 'Proprietary' },
    linear: { mark: 'no', note: 'Proprietary' },
    plane: { mark: 'partial', note: 'AGPL-3.0 core' },
  },
  {
    feature: 'Self-host (one Docker Compose)',
    tasknebula: { mark: 'yes', note: 'Postgres + Redis + one web image' },
    jira: { mark: 'no', note: 'Cloud-first; DC phased out' },
    linear: { mark: 'no', note: 'Cloud only' },
    plane: { mark: 'yes', note: 'Docker / Kubernetes' },
  },
  {
    feature: 'Price',
    tasknebula: { mark: 'yes', note: 'Free, unlimited users, self-hosted' },
    jira: { mark: 'partial', note: 'Free ≤10 users, then per-seat' },
    linear: { mark: 'partial', note: 'Free tier, then per-seat' },
    plane: { mark: 'partial', note: 'Free ≤12 users, then per-seat' },
  },
  {
    feature: 'AI agents native + MCP server',
    tasknebula: { mark: 'yes', note: 'Built-in agents + MIT MCP server' },
    jira: { mark: 'partial', note: 'Rovo + remote MCP, cloud-only' },
    linear: { mark: 'partial', note: 'AI + remote MCP server' },
    plane: { mark: 'partial', note: 'Plane AI (credits) + MCP' },
  },
  {
    feature: 'Keyboard-first',
    tasknebula: { mark: 'yes', note: 'Command palette + shortcuts' },
    jira: { mark: 'partial', note: 'Limited shortcuts' },
    linear: { mark: 'yes', note: 'Best-in-class' },
    plane: { mark: 'yes', note: 'Command-K palette' },
  },
  {
    feature: 'Realtime collab',
    tasknebula: { mark: 'yes', note: 'Live cursors via Yjs' },
    jira: { mark: 'partial', note: 'Live sync, no co-editing' },
    linear: { mark: 'yes', note: 'Live sync' },
    plane: { mark: 'yes', note: 'Live sync' },
  },
  {
    feature: 'Jira / Linear import',
    tasknebula: { mark: 'yes', note: 'CSV + API import' },
    jira: { mark: 'partial', note: 'Imports to Jira' },
    linear: { mark: 'yes', note: 'Jira import built-in' },
    plane: { mark: 'yes', note: 'Jira / Linear importers' },
  },
  {
    feature: 'Sprints / Cycles',
    tasknebula: { mark: 'yes', note: 'Sprints + backlog' },
    jira: { mark: 'yes', note: 'Scrum + Kanban' },
    linear: { mark: 'yes', note: 'Cycles' },
    plane: { mark: 'yes', note: 'Cycles + modules' },
  },
  {
    feature: 'Labels / Components / Versions',
    tasknebula: { mark: 'yes', note: 'First-class, all three' },
    jira: { mark: 'yes', note: 'All three' },
    linear: { mark: 'partial', note: 'Labels + projects' },
    plane: { mark: 'partial', note: 'Labels + modules' },
  },
  {
    feature: 'API / Projects-as-code',
    tasknebula: { mark: 'yes', note: 'Open REST + OpenAPI spec' },
    jira: { mark: 'partial', note: 'REST API, no IaC' },
    linear: { mark: 'partial', note: 'GraphQL API' },
    plane: { mark: 'partial', note: 'REST API' },
  },
] as const;

const markMeta: Record<Mark, { label: string; accentVar: string }> = {
  yes: { label: 'Yes', accentVar: 'var(--landing-accent-emerald)' },
  partial: { label: 'Partial', accentVar: 'var(--landing-accent-amber)' },
  no: { label: 'No', accentVar: 'var(--landing-text-muted)' },
};

function MarkGlyph({ mark }: { mark: Mark }) {
  const { accentVar } = markMeta[mark];

  if (mark === 'yes') {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke={accentVar}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13 4.5 6.5 11.5 3 8" />
      </svg>
    );
  }

  if (mark === 'partial') {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke={accentVar}
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3l2 2" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke={accentVar}
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 8h8" />
    </svg>
  );
}

function CompareCell({ cell, highlight = false }: { cell: Cell; highlight?: boolean }) {
  const { label } = markMeta[cell.mark];
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5">
        <MarkGlyph mark={cell.mark} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="sr-only">{label}: </span>
        <span
          className={`text-[13px] leading-5 ${
            highlight ? 'text-[var(--landing-text)]' : 'text-[var(--landing-text-subtle)]'
          }`}
        >
          {cell.note}
        </span>
      </span>
    </div>
  );
}

function ColHeader({
  name,
  highlight = false,
  accentVar,
}: {
  name: string;
  highlight?: boolean;
  accentVar?: string;
}): ReactNode {
  return (
    <th
      scope="col"
      className={`px-5 py-4 text-[13px] ${
        highlight
          ? 'font-[520] text-[var(--landing-text-dark)]'
          : 'font-[440] text-[var(--landing-text-body)]'
      }`}
    >
      {highlight && accentVar ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accentVar }}
            aria-hidden="true"
          />
          {name}
        </span>
      ) : (
        name
      )}
    </th>
  );
}

export function Comparison() {
  return (
    <section id="compare" className="border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <SectionHeader
          kicker="Compare"
          kickerAccentVar="var(--landing-accent-amber)"
          title="TaskNebula vs Jira vs Linear vs Plane"
          description="All four are capable tools. Here is exactly where TaskNebula differs — open by default, yours to host, AI-native. Nothing more, nothing less."
        />

        <div
          tabIndex={0}
          role="region"
          aria-label="Feature comparison table"
          className="mt-10 overflow-x-auto rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
        >
          <table className="w-full min-w-[820px] border-collapse text-left">
            <caption className="sr-only">
              Feature comparison between TaskNebula, Jira, Linear, and Plane. Each cell is marked
              Yes, Partial, or No, followed by a short detail.
            </caption>
            <thead>
              <tr className="border-b border-[var(--landing-border)]">
                <th
                  scope="col"
                  className="px-5 py-4 text-[11px] font-[500] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]"
                >
                  Feature
                </th>
                <ColHeader name="TaskNebula" highlight accentVar="var(--landing-accent-blue)" />
                <ColHeader name="Jira" />
                <ColHeader name="Linear" />
                <ColHeader name="Plane" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.feature}
                  className="border-b border-[var(--landing-border)] last:border-b-0"
                >
                  <th
                    scope="row"
                    className="whitespace-nowrap px-5 py-4 align-top text-[12px] font-[500] text-[var(--landing-text-subtle)]"
                  >
                    {row.feature}
                  </th>
                  <td className="bg-[var(--landing-bg-surface)] px-5 py-4 align-top">
                    <CompareCell cell={row.tasknebula} highlight />
                  </td>
                  <td className="px-5 py-4 align-top">
                    <CompareCell cell={row.jira} />
                  </td>
                  <td className="px-5 py-4 align-top">
                    <CompareCell cell={row.linear} />
                  </td>
                  <td className="px-5 py-4 align-top">
                    <CompareCell cell={row.plane} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          {(['yes', 'partial', 'no'] as const).map((mark) => (
            <span key={mark} className="inline-flex items-center gap-2">
              <MarkGlyph mark={mark} />
              <span className="text-[12px] text-[var(--landing-text-subtle)]">
                {markMeta[mark].label}
              </span>
            </span>
          ))}
        </div>

        <p className="mt-4 text-[11px] leading-5 text-[var(--landing-text-subtle)]">
          Vendor details reflect public documentation and pricing pages as of June 2026 and may
          change. Jira is a trademark of Atlassian, Linear of Linear Orbit, and Plane of Plane
          Software — all are solid products, none affiliated with TaskNebula.
        </p>
      </Shell>
    </section>
  );
}
