'use client';

/**
 * Triage suggestions panel for the issue detail page (P0-02).
 *
 * Renders the most recent pending triage suggestion for an issue and
 * exposes Apply / Dismiss controls. Polls /api/issues/[id]/triage so
 * suggestions that arrived via the fire-and-forget enqueue from POST
 * /api/issues show up shortly after the issue was created.
 *
 * TODO(P1, ui): wire this component into the issue sidebar at
 *   apps/web/src/components/issues/issue-detail-view.tsx (around line 124,
 *   inside the right column above <IssueSidebar />). Today the component
 *   stands alone so the placement decision can live with the issue-UI
 *   owner — the existing sidebar layout is dense and merits a design
 *   review pass before we drop another card into it.
 */

import { useCallback, useEffect, useState } from 'react';

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
      const pending = (body.suggestions || []).find(
        (s) => !s.appliedAt && !s.dismissedAt,
      );
      setLatest(pending ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load');
    } finally {
      setLoading(false);
    }
  }, [issueId]);

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
      setError(err instanceof Error ? err.message : 'failed to run triage');
    } finally {
      setBusy(false);
    }
  }, [issueId, refresh]);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'apply failed');
      } finally {
        setBusy(false);
      }
    },
    [issueId, latest, refresh],
  );

  return (
    <section
      aria-label="Triage suggestions"
      className="rounded-md border border-border bg-card p-3 text-sm"
    >
      <header className="mb-2 flex items-center justify-between">
        <h3 className="font-medium">Triage suggestions</h3>
        <button
          type="button"
          onClick={runNow}
          disabled={busy}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Run again'}
        </button>
      </header>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : !latest ? (
        <p className="text-xs text-muted-foreground">
          No pending suggestion. Press “Run again” to ask the agent.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Confidence: {latest.confidence}%
          </p>
          {latest.payload.priority ? (
            <p>
              Priority: <span className="font-medium">{latest.payload.priority}</span>
            </p>
          ) : null}
          {latest.payload.labels && latest.payload.labels.length > 0 ? (
            <p>Labels: {latest.payload.labels.join(', ')}</p>
          ) : null}
          {latest.payload.rationale ? (
            <p className="text-xs text-muted-foreground italic">
              {latest.payload.rationale}
            </p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => apply(false)}
              disabled={busy}
              className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => apply(true)}
              disabled={busy}
              className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
            >
              Apply (override threshold)
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
