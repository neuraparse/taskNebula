'use client';

/**
 * Agent Activity panel (P0-04 placeholder).
 *
 * Rendered in the issue sidebar when the assignee is a virtual agent user
 * (`users.is_agent = true`). Shows the live `agent_sessions` state for the
 * current issue and exposes a dispatch action that POSTs to
 * `/api/issues/[id]/dispatch-agent`.
 *
 * This file is intentionally minimal: the full UX (timeline, retry, prompt
 * editor, PR preview) lands in a follow-up task. Today we wire up enough of a
 * shell that QA can see sessions tick through `pending` → `active` →
 * `complete` end-to-end.
 *
 * TODO(agent-ui): replace this placeholder with a streaming session timeline
 * + prompt override editor + retry button, and pull live state from the
 * /api/issues/[id]/agent-sessions endpoint (to be added in a follow-up).
 */

import { Bot, Loader2, RefreshCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type AgentProviderKind = 'claude' | 'cursor' | 'devin' | 'copilot' | 'openhands' | 'custom';

interface AgentActivityPanelProps {
  issueId: string;
  agentProvider: AgentProviderKind | null;
  assigneeName?: string | null;
}

export function AgentActivityPanel({
  issueId,
  agentProvider,
  assigneeName,
}: AgentActivityPanelProps) {
  const t = useTranslations('issuePanels');
  const [dispatching, setDispatching] = useState(false);
  const [lastState, setLastState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!agentProvider) return null;

  const onDispatch = async () => {
    setDispatching(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/dispatch-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: agentProvider }),
      });
      const json = (await res.json()) as { state?: string; error?: string };
      if (!res.ok) {
        setError(json.error || t('agent.dispatch_failed_status', { status: res.status }));
      } else {
        setLastState(json.state ?? 'active');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('agent.dispatch_failed'));
    } finally {
      setDispatching(false);
    }
  };

  return (
    <section className="border-border/60 bg-muted/30 space-y-2 rounded-md border p-3">
      <header className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <Bot className="h-3.5 w-3.5" />
        <span>{t('agent.title')}</span>
      </header>

      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex flex-col">
          <span className="font-medium">{assigneeName ?? agentProvider}</span>
          <span className="text-muted-foreground text-xs">
            {lastState ? t('agent.state', { state: lastState }) : t('agent.idle')}
          </span>
        </div>
        <button
          type="button"
          onClick={onDispatch}
          disabled={dispatching}
          className="border-border bg-background hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-60"
        >
          {dispatching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" />
          )}
          {t('agent.dispatch')}
        </button>
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {/* TODO(agent-ui): live state subscription, session history, prompt override editor. */}
    </section>
  );
}
