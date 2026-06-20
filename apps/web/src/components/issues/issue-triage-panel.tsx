'use client';

/**
 * Triage suggestions panel for the issue detail page (P0-02).
 *
 * Renders the most recent pending triage suggestion for an issue and
 * exposes Apply controls. Polls /api/issues/[id]/triage so suggestions
 * that arrived via the fire-and-forget enqueue from POST /api/issues show
 * up shortly after the issue was created.
 *
 * Mounted in issue-detail-view.tsx inside a collapsible "AI triage"
 * section (gated on `useAiCapability().canRunAgents`) — the section
 * supplies the header, so this component renders content only.
 */

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { invalidateIssueCaches } from '@/lib/realtime/issue-cache';

type Suggestion = {
  id: string;
  issueId: string;
  payload: {
    labels?: string[];
    priority?: string;
    suggested_assignee_id?: string | null;
    team_id?: string | null;
    confidence?: number;
    rationale?: string;
  };
  confidence: number;
  appliedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
};

export function IssueTriagePanel({ issueId }: { issueId: string }) {
  const t = useTranslations('issueDetail.triage');
  const queryClient = useQueryClient();
  const [latest, setLatest] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/triage`, { method: 'GET' });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const body = (await res.json()) as { suggestions: Suggestion[] };
      const pending = (body.suggestions || []).find((s) => !s.appliedAt && !s.dismissedAt);
      setLatest(pending ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [issueId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runNow = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/triage`, { method: 'POST' });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('runFailed'));
    } finally {
      setBusy(false);
    }
  }, [issueId, refresh, t]);

  const apply = useCallback(
    async (force: boolean) => {
      if (!latest) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/issues/${issueId}/triage/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suggestionId: latest.id,
            approved: force,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Status ${res.status}`);
        }
        await refresh();
        // Applying mutates priority / labels / assignee on the issue itself —
        // refresh every issue-derived surface (lists, sprint-issues, my-issues,
        // your-work, dashboards) so the change reflects everywhere instantly.
        const cached = queryClient.getQueryData<{ projectId?: string; sprintId?: string | null }>([
          'issue',
          issueId,
        ]);
        invalidateIssueCaches(queryClient, {
          issueId,
          projectId: cached?.projectId,
          sprintId: cached?.sprintId ?? null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('applyFailed'));
      } finally {
        setBusy(false);
      }
    },
    [issueId, latest, queryClient, refresh, t]
  );

  return (
    <div className="space-y-2 text-sm" data-testid="issue-triage-panel">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={runNow}
          disabled={busy}
          className="text-muted-foreground ease-snap hover:text-foreground text-xs transition-colors duration-150 disabled:opacity-50"
        >
          {busy ? t('working') : t('runAgain')}
        </button>
      </div>
      {loading ? (
        <p className="text-muted-foreground text-xs">{t('loading')}</p>
      ) : error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : !latest ? (
        <p className="text-muted-foreground text-xs">{t('empty')}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {t('confidence', { value: latest.confidence })}
          </p>
          {latest.payload.priority ? (
            <p>
              {t('priority')}: <span className="font-medium">{latest.payload.priority}</span>
            </p>
          ) : null}
          {latest.payload.labels && latest.payload.labels.length > 0 ? (
            <p>
              {t('labels')}: {latest.payload.labels.join(', ')}
            </p>
          ) : null}
          {latest.payload.rationale ? (
            <p className="text-muted-foreground text-xs italic">{latest.payload.rationale}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => apply(false)}
              disabled={busy}
              className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs disabled:opacity-50"
            >
              {t('apply')}
            </button>
            <button
              type="button"
              onClick={() => apply(true)}
              disabled={busy}
              className="border-border rounded-md border px-2 py-1 text-xs disabled:opacity-50"
            >
              {t('applyOverride')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
