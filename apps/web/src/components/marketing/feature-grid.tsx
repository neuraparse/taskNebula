import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bot, ChartColumn, Command, GitMerge, Server, Sparkles, Tags, Users } from 'lucide-react';
import { SectionHeader, Shell } from './primitives';

type Tone = 'blue' | 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose';

export function FeatureGrid() {
  return (
    <section id="features" className="border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <SectionHeader
          kicker="The workflow"
          kickerAccentVar="var(--landing-accent-blue)"
          title="From keystroke to ship — one open backlog."
          description="Plan, execute, and reason over the work in the same surface. Keyboard-first delivery, an AI layer you can audit, and agents that move tickets through a real MCP server — all MIT-licensed and self-hostable."
        />

        <div className="stagger mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <FeatureCell
            className="xl:col-span-4"
            icon={Command}
            tone="blue"
            title="Keyboard-first boards and sprints"
            body="Drive the whole board from one Cmd+K palette — search, navigate, and run actions without leaving the keys. Drag across columns, plan sprints, and read burndown in the same view."
          >
            <PaletteVisual />
          </FeatureCell>

          <FeatureCell
            className="xl:col-span-2"
            icon={GitMerge}
            tone="cyan"
            title="Import from Jira and Linear"
            body="Bring your backlog with you — Jira, Linear, and CSV importers map issues, statuses, and metadata so you start full, not empty."
          >
            <ImportVisual />
          </FeatureCell>

          <FeatureCell
            className="xl:col-span-2"
            icon={Tags}
            tone="violet"
            title="Jira-parity structure"
            badge={<span className="chip-violet">0.4.0</span>}
            body="First-class labels, components, fix versions, and a resolution model — backlog structure stored in real tables and REST APIs, not JSON strings."
          >
            <StructureVisual />
          </FeatureCell>

          <FeatureCell
            className="xl:col-span-2"
            icon={Sparkles}
            tone="amber"
            title="AI-native, auditable"
            body="Real OpenAI and Anthropic calls behind a cost guard and tracing — triage suggestions, AI estimates, and a /api/ask RAG endpoint over pgvector. No black boxes."
          >
            <AiVisual />
          </FeatureCell>

          <FeatureCell
            className="xl:col-span-2"
            icon={Bot}
            tone="emerald"
            title="Agents work the backlog"
            body="A real MCP server — HTTP at /api/mcp or stdio — lets coding agents create, search, and move issues. Backed by a REST API, OpenAPI spec, revocable keys, and webhooks."
          >
            <McpVisual />
          </FeatureCell>

          <FeatureCell
            className="xl:col-span-2"
            icon={Users}
            tone="rose"
            title="Realtime collaboration"
            body="Specs and issue docs edit live — Tiptap on Yjs with presence and conflict-free merges, so two people on one doc just works."
          >
            <CollabVisual />
          </FeatureCell>

          <FeatureCell
            className="xl:col-span-3"
            icon={Server}
            tone="violet"
            title="Self-host in minutes"
            body="One Docker image, Postgres, and you own the data. Multi-tenant from the schema up — every table is organization-scoped, no vendor lock-in."
          >
            <DeployVisual />
          </FeatureCell>

          <FeatureCell
            className="xl:col-span-3"
            icon={ChartColumn}
            tone="cyan"
            title="Analytics close to execution"
            body="Velocity, cycle time, and priority mix per project — with a resolution model that separates Done from Won't Fix and Duplicate."
          >
            <AnalyticsVisual />
          </FeatureCell>
        </div>
      </Shell>
    </section>
  );
}

function FeatureCell({
  icon: Icon,
  tone,
  title,
  body,
  badge,
  children,
  className = '',
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  body: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`ease-smooth flex h-full flex-col rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={`icon-tile icon-tile-accent-${tone} h-10 w-10`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        {badge}
      </div>
      <h3 className="landing-title mt-5 text-[20px] text-[var(--landing-text-dark)]">{title}</h3>
      <p className="landing-body mt-2.5 text-[14px] text-[var(--landing-text-subtle)]">{body}</p>
      <div className="mt-5 flex-1" aria-hidden="true">
        {children}
      </div>
    </article>
  );
}

/* ----------------------------------------------------------------------------
   Small CSS-only visuals — pure DOM, no images, decorative (aria-hidden above)
   ---------------------------------------------------------------------------- */

const miniColumns = [
  { name: 'To Do', accent: 'var(--landing-text-body)', cards: [56, 72] },
  { name: 'In Progress', accent: 'var(--landing-accent-blue)', cards: [64, 48, 70] },
  { name: 'Done', accent: 'var(--landing-accent-emerald)', cards: [60] },
] as const;

function PaletteVisual() {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--landing-border)] px-3 py-2">
          <span className="text-[11px] text-[var(--landing-text-muted)]">
            move WEB-18 to review
          </span>
          <span className="flex gap-1">
            <kbd className="landing-kbd">⌘</kbd>
            <kbd className="landing-kbd">K</kbd>
          </span>
        </div>
        <div className="space-y-1 p-2">
          <div className="flex items-center justify-between rounded-sm bg-[var(--landing-bg-elevated)] px-2.5 py-1.5">
            <span className="text-[10px] text-[var(--landing-text)]">Move WEB-18 → In Review</span>
            <kbd className="landing-kbd">↵</kbd>
          </div>
          <div className="px-2.5 py-1.5 text-[10px] text-[var(--landing-text-muted)]">
            Assign WEB-18 to me
          </div>
        </div>
      </div>
      <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
        <div className="grid grid-cols-3 gap-2">
          {miniColumns.map((column) => (
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
                    <div className="mt-1 h-1.5 w-1/3 rounded-full bg-[var(--landing-border)]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImportVisual() {
  const sources = [
    { name: 'Jira', tone: 'chip-blue' },
    { name: 'Linear', tone: 'chip-violet' },
    { name: 'CSV', tone: 'chip-emerald' },
  ] as const;
  return (
    <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <span key={source.name} className={source.tone}>
            {source.name}
          </span>
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          { ref: 'PROJ-204', label: 'Status mapped' },
          { ref: 'PROJ-318', label: 'Labels mapped' },
        ].map((row) => (
          <div
            key={row.ref}
            className="flex items-center justify-between rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-2.5 py-1.5"
          >
            <span className="font-mono text-[10px] text-[var(--landing-text-body)]">{row.ref}</span>
            <span className="text-[9px] text-[var(--landing-text-muted)]">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StructureVisual() {
  return (
    <div className="space-y-2 rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
      <div className="flex flex-wrap gap-1.5">
        <span className="chip-blue">api</span>
        <span className="chip-violet">design</span>
        <span className="chip-rose">bug</span>
      </div>
      <div className="flex items-center justify-between rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-2.5 py-1.5">
        <span className="font-mono text-[10px] text-[var(--landing-text-body)]">v1.2.0</span>
        <span className="text-[9px] text-[var(--landing-text-muted)]">Fix version</span>
      </div>
      <div className="flex items-center justify-between rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-2.5 py-1.5">
        <span className="font-mono text-[10px] text-[var(--landing-text-body)]">checkout</span>
        <span className="text-[9px] text-[var(--landing-text-muted)]">Component</span>
      </div>
    </div>
  );
}

function AiVisual() {
  return (
    <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
          /api/ask · RAG
        </p>
        <span className="text-[9px] text-[var(--landing-text-muted)]">pgvector</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="chip-amber">Triage: High</span>
        <span className="chip-blue">Estimate: 5 pts</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-sm border border-[var(--landing-border-strong)] bg-[var(--landing-bg)] px-2.5 py-1 text-[10px] text-[var(--landing-text-dark)]">
          Accept
        </span>
        <span className="rounded-sm border border-[var(--landing-border)] px-2.5 py-1 text-[10px] text-[var(--landing-text-muted)]">
          Dismiss
        </span>
      </div>
    </div>
  );
}

function McpVisual() {
  return (
    <div className="landing-terminal p-3">
      <p className="font-mono text-[10px] leading-5 text-[var(--landing-text-body)]">
        <span className="text-[var(--landing-text-muted)]">$ </span>POST /api/mcp
      </p>
      <p className="font-mono text-[10px] leading-5 text-[var(--landing-text-muted)]">
        @tasknebula/mcp-server
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="chip-emerald">create_issue</span>
        <span className="chip-emerald">search_issues</span>
      </div>
    </div>
  );
}

function CollabVisual() {
  return (
    <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-[500] text-[var(--landing-text-dark)]">Launch plan — Q3</p>
        <span className="live-pill">
          <span className="status-dot status-live" />2 live
        </span>
      </div>
      <div className="mt-2.5 space-y-1.5">
        <div className="h-1.5 w-11/12 rounded-full bg-[var(--landing-border-strong)]" />
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-2/3 rounded-full bg-[var(--landing-border)]" />
          <span
            className="h-3 w-[2px] rounded-full"
            style={{ backgroundColor: 'var(--landing-accent-rose)' }}
          />
        </div>
        <div className="h-1.5 w-4/5 rounded-full bg-[var(--landing-border)]" />
      </div>
    </div>
  );
}

function DeployVisual() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="landing-terminal p-3">
        <p className="font-mono text-[10px] leading-5 text-[var(--landing-text-body)]">
          <span className="text-[var(--landing-text-muted)]">$ </span>docker compose up
        </p>
        <p className="font-mono text-[10px] leading-5 text-[var(--landing-text-muted)]">
          neuraparse/tasknebula
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="status-dot status-live" />
          <span className="text-[10px] text-[var(--landing-text-muted)]">/api/health · ok</span>
        </div>
      </div>
      <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
        <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
          Tenant isolation
        </p>
        <div className="mt-2.5 space-y-1.5">
          {['Acme', 'Globex', 'Initech'].map((org) => (
            <div
              key={org}
              className="flex items-center gap-2 rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-2 py-1"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: 'var(--landing-accent-violet)' }}
              />
              <span className="font-mono text-[9px] text-[var(--landing-text-body)]">{org}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const velocityBars = [14, 18, 16, 21, 19, 23] as const;

function AnalyticsVisual() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
        <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
          Velocity
        </p>
        <div className="mt-2 flex h-[52px] items-end gap-1.5">
          {velocityBars.map((value, index) => (
            <div
              key={index}
              className="flex-1 rounded-t"
              style={{
                height: `${(value / 25) * 100}%`,
                backgroundColor:
                  index === velocityBars.length - 1
                    ? 'var(--landing-accent-blue)'
                    : 'color-mix(in srgb, var(--landing-accent-blue) 30%, transparent)',
              }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
        <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
          Resolution
        </p>
        <div className="mt-3 space-y-2">
          {[
            { label: 'Fixed', width: 78, color: 'var(--landing-accent-emerald)' },
            { label: "Won't do", width: 22, color: 'var(--landing-text-muted)' },
            { label: 'Duplicate', width: 12, color: 'var(--landing-accent-amber)' },
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
