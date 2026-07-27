import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SectionHeader, Shell } from './primitives';

const capabilities = ['ask', 'triage', 'mcp'] as const;

export function AiMcpSection() {
  const t = useTranslations('publicPages.landing.aiMcp');

  return (
    <section id="ai-mcp" className="border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <SectionHeader
              kicker={t('kicker')}
              kickerAccentVar="var(--landing-accent-violet)"
              title={t('title')}
              description={t('description')}
              compact
            />

            <ol className="mt-9 border-t border-[var(--landing-border)]">
              {capabilities.map((key, index) => (
                <li
                  key={key}
                  className="grid gap-3 border-b border-[var(--landing-border)] py-5 sm:grid-cols-[2.5rem_1fr]"
                >
                  <span
                    className="font-mono text-[11px] text-[var(--landing-text-muted)]"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-[500] text-[var(--landing-text-dark)]">
                      {t(`capabilities.${key}.title`)}
                    </h3>
                    <p className="landing-body mt-1.5 text-[13px] leading-6 text-[var(--landing-text-subtle)]">
                      {t(`capabilities.${key}.body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
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
  const t = useTranslations('publicPages.landing.aiMcp.mock');
  const resultRows = [
    { id: 'WEB-204', label: t('resultLabels.checkout') },
    { id: 'WEB-211', label: t('resultLabels.flaky') },
    { id: 'API-58', label: t('resultLabels.tests') },
  ];

  return (
    <div className="landing-terminal animate-fade-up overflow-hidden" aria-hidden="true">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--landing-border)] px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-[11px] text-[var(--landing-text-subtle)]">
          <Bot className="h-3.5 w-3.5 text-[var(--landing-accent-violet)]" aria-hidden="true" />
          {t('session')}
        </span>
        <span className="flex items-center gap-1.5 rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--landing-text-muted)]">
          <span className="status-dot status-live h-1.5 w-1.5" />
          {t('connected')}
        </span>
      </div>

      <div className="space-y-3 p-4 font-mono text-[11px] leading-6">
        {/* Agent reasons, then calls a tool */}
        <p className="text-[var(--landing-text-muted)]">
          <span className="select-none text-[var(--landing-accent-violet)]">{t('agent')}</span> ·{' '}
          {t('planning')}
        </p>

        <div className="border-l-2 border-[var(--landing-accent-cyan)] bg-[var(--landing-bg-surface)] py-2 pl-3 pr-2">
          <p className="text-[var(--landing-text-muted)]">
            <span className="text-[var(--landing-accent-cyan)]">→ {t('call')}</span> search_issues
          </p>
          <pre className="mt-1.5 whitespace-pre-wrap text-[var(--landing-text-body)]">
            <code>{'{ "query": "flaky checkout tests", "status": "open" }'}</code>
          </pre>
        </div>

        <div className="border-l-2 border-[var(--landing-accent-emerald)] bg-[var(--landing-bg-surface)] py-2 pl-3 pr-2">
          <p className="text-[var(--landing-text-muted)]">
            <span className="text-[var(--landing-accent-emerald)]">← {t('result')}</span>{' '}
            {t('issueCount')}
          </p>
          <div className="mt-2 space-y-1.5">
            {resultRows.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-1.5 py-0.5 text-[10px] text-[var(--landing-text-body)]">
                  {row.id}
                </span>
                <span className="text-[10px] text-[var(--landing-text-muted)]">{row.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-l-2 border-[var(--landing-accent-cyan)] bg-[var(--landing-bg-surface)] py-2 pl-3 pr-2">
          <p className="text-[var(--landing-text-muted)]">
            <span className="text-[var(--landing-accent-cyan)]">→ {t('call')}</span> update_issue
          </p>
          <pre className="mt-1.5 whitespace-pre-wrap text-[var(--landing-text-body)]">
            <code>{'{ "id": "WEB-211", "priority": "high", "labels": ["flaky"] }'}</code>
          </pre>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] text-[var(--landing-text-muted)]">{t('applied')}</span>
          <span className="chip-emerald">{t('priorityHigh')}</span>
          <span className="chip-cyan">{t('labelFlaky')}</span>
        </div>
      </div>
    </div>
  );
}
