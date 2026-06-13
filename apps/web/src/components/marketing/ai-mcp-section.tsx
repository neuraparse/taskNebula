import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bot, MessagesSquare, Plug, Sparkles } from 'lucide-react';
import { SectionHeader, Shell } from './primitives';

type Tone = 'violet' | 'cyan' | 'emerald';

const capabilities: Array<{
  icon: LucideIcon;
  tone: Tone;
  title: string;
  body: string;
}> = [
  {
    icon: MessagesSquare,
    tone: 'cyan',
    title: 'Ask your workspace',
    body: 'The /api/ask RAG endpoint answers in natural language over your issues, docs, and comments — grounded in pgvector retrieval, with citations back to the source.',
  },
  {
    icon: Sparkles,
    tone: 'violet',
    title: 'AI triage & estimates',
    body: 'Suggested priority, labels, and effort land on new issues — backed by real OpenAI and Anthropic calls, a cost guard, and tracing. You stay in control: accept or dismiss.',
  },
  {
    icon: Plug,
    tone: 'emerald',
    title: 'MCP tools for agents',
    body: '@tasknebula/mcp-server exposes the backlog over MCP — HTTP at /api/mcp or stdio — so external agents create, search, and move issues with revocable keys.',
  },
];

export function AiMcpSection() {
  return (
    <section id="ai-mcp" className="border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <SectionHeader
              kicker="AI-native"
              kickerAccentVar="var(--landing-accent-violet)"
              title="Agents work the backlog with you."
              description="TaskNebula was built for the agent era. Ask questions across your whole workspace, let AI triage and estimate new work, and give external agents real tools through a first-class MCP server."
              compact
            />

            <div className="stagger mt-9 space-y-3">
              {capabilities.map(({ icon: Icon, tone, title, body }) => (
                <div
                  key={title}
                  className="ease-smooth flex gap-4 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className={`icon-tile icon-tile-accent-${tone} h-10 w-10 shrink-0`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-[500] text-[var(--landing-text-dark)]">
                      {title}
                    </h3>
                    <p className="landing-body mt-1.5 text-[13px] leading-6 text-[var(--landing-text-subtle)]">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ToolCallMock />
        </div>
      </Shell>
    </section>
  );
}

/* ----------------------------------------------------------------------------
   Stylized MCP tool-call vignette — pure DOM, decorative.
   Shows an external agent calling an MCP tool and TaskNebula responding.
   ---------------------------------------------------------------------------- */

function ToolCallMock() {
  return (
    <div className="landing-terminal animate-fade-up overflow-hidden" aria-hidden="true">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--landing-border)] px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-[11px] text-[var(--landing-text-subtle)]">
          <Bot className="h-3.5 w-3.5 text-[var(--landing-accent-violet)]" aria-hidden="true" />
          agent session — @tasknebula/mcp-server
        </span>
        <span className="flex items-center gap-1.5 rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--landing-text-muted)]">
          <span className="status-dot status-live h-1.5 w-1.5" />
          connected
        </span>
      </div>

      <div className="space-y-3 p-4 font-mono text-[11px] leading-6">
        {/* Agent reasons, then calls a tool */}
        <p className="text-[var(--landing-text-muted)]">
          <span className="select-none text-[var(--landing-accent-violet)]">agent</span> · planning
          the sprint cleanup
        </p>

        <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
          <p className="text-[var(--landing-text-muted)]">
            <span className="text-[var(--landing-accent-cyan)]">→ call</span> search_issues
          </p>
          <pre className="mt-1.5 whitespace-pre-wrap text-[var(--landing-text-body)]">
            <code>{'{ "query": "flaky checkout tests", "status": "open" }'}</code>
          </pre>
        </div>

        <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
          <p className="text-[var(--landing-text-muted)]">
            <span className="text-[var(--landing-accent-emerald)]">← result</span> 3 issues
          </p>
          <div className="mt-2 space-y-1.5">
            {[
              { id: 'WEB-204', label: 'checkout' },
              { id: 'WEB-211', label: 'flaky' },
              { id: 'API-58', label: 'tests' },
            ].map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-1.5 py-0.5 text-[10px] text-[var(--landing-text-body)]">
                  {row.id}
                </span>
                <span className="text-[10px] text-[var(--landing-text-muted)]">{row.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
          <p className="text-[var(--landing-text-muted)]">
            <span className="text-[var(--landing-accent-cyan)]">→ call</span> update_issue
          </p>
          <pre className="mt-1.5 whitespace-pre-wrap text-[var(--landing-text-body)]">
            <code>{'{ "id": "WEB-211", "priority": "high", "labels": ["flaky"] }'}</code>
          </pre>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] text-[var(--landing-text-muted)]">applied</span>
          <span className="chip-emerald">priority: high</span>
          <span className="chip-cyan">label: flaky</span>
        </div>
      </div>
    </div>
  );
}
