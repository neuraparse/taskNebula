'use client';

/**
 * <TimeTrackingPanel issueId> — server-backed time tracking (task #10).
 *
 * Pairs with the API endpoints:
 *   POST  /api/issues/[id]/timer/start
 *   POST  /api/issues/[id]/timer/stop
 *   POST  /api/issues/[id]/time-entries  (manual log)
 *   POST  /api/issues/[id]/ai-estimate
 *   PATCH /api/issues/[id]              ({ estimateHours, estimateSource })
 *
 * Mounted in the issue detail right column (issue-detail-view.tsx) inside a
 * collapsible section — the section supplies the header, so this component
 * renders content only. The estimate field persists via PATCH on blur or via
 * the explicit "Save estimate" button that appears when the value is dirty.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Play, Square, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDurationSeconds, parseDuration } from '@/lib/time-tracking/duration';

interface TimeTrackingPanelProps {
  issueId: string;
  initialEstimateHours?: number | null;
  initialActualHours?: number | null;
  initialEstimateSource?: string | null;
  className?: string;
}

interface AiSuggestion {
  estimateHours: number | null;
  p25Hours: number | null;
  p75Hours: number | null;
  rationale: string;
  reason: string;
  sampleSize: number;
}

interface RunningEntry {
  id: string;
  startedAt: string;
}

function errorMessage(err: unknown, fallback: string): string {
  return fallback;
}

export function TimeTrackingPanel({
  issueId,
  initialEstimateHours = null,
  initialActualHours = null,
  initialEstimateSource = null,
  className,
}: TimeTrackingPanelProps) {
  const t = useTranslations('issueDetail.timeTracking');
  const tTrio = useTranslations('timeTrio');
  const queryClient = useQueryClient();

  const [estimateHours, setEstimateHours] = useState<string>(
    initialEstimateHours != null ? String(initialEstimateHours) : ''
  );
  // Last value persisted to the server — drives the dirty-state Save button.
  const [savedEstimate, setSavedEstimate] = useState<string>(
    initialEstimateHours != null ? String(initialEstimateHours) : ''
  );
  const [estimateSource, setEstimateSource] = useState<string | null>(initialEstimateSource);
  const [actualHours, setActualHours] = useState<number>(initialActualHours ?? 0);
  const [running, setRunning] = useState<RunningEntry | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [manualDuration, setManualDuration] = useState('');
  const [manualNote, setManualNote] = useState('');

  // Tick once a second while a timer is running, for the live label.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const elapsedLabel = useMemo(() => {
    if (!running) return null;
    const startedMs = new Date(running.startedAt).getTime();
    if (Number.isNaN(startedMs)) return null;
    const seconds = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
    // Reference `tick` so React re-renders.
    void tick;
    return formatDurationSeconds(seconds);
  }, [running, tick]);

  const invalidateIssue = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
    queryClient.invalidateQueries({ queryKey: ['issues'] });
  }, [issueId, queryClient]);

  const estimateDirty = estimateHours.trim() !== savedEstimate.trim();

  const persistEstimate = useCallback(
    async (source: 'manual' | 'ai_suggest') => {
      const trimmed = estimateHours.trim();
      if (trimmed === savedEstimate.trim()) return;
      let value: number | null = null;
      if (trimmed !== '') {
        value = Number(trimmed);
        if (!Number.isFinite(value) || value < 0) {
          setError(t('invalidEstimate'));
          return;
        }
      }
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(`/api/issues/${issueId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estimateHours: value,
            estimateSource: value == null ? null : source,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSavedEstimate(trimmed);
        setEstimateSource(value == null ? null : source);
        invalidateIssue();
      } catch (e) {
        setError(errorMessage(e, t('saveEstimateFailed')));
      } finally {
        setBusy(false);
      }
    },
    [estimateHours, invalidateIssue, issueId, savedEstimate, t]
  );

  const startTimer = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/timer/start`, {
        method: 'POST',
      });
      if (res.status === 409) {
        const body = await res.json();
        setRunning(body.running ?? null);
        setError(t('timerAlreadyRunning'));
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setRunning({ id: body.entry.id, startedAt: body.entry.startedAt });
    } catch (e) {
      setError(errorMessage(e, t('startFailed')));
    } finally {
      setBusy(false);
    }
  }, [issueId, t]);

  const stopTimer = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/timer/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setRunning(null);
      if (typeof body.actualHours === 'number') {
        setActualHours(body.actualHours);
      }
      invalidateIssue();
    } catch (e) {
      setError(errorMessage(e, t('stopFailed')));
    } finally {
      setBusy(false);
    }
  }, [invalidateIssue, issueId, t]);

  const requestAiEstimate = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/ai-estimate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as AiSuggestion;
      setSuggestion(body);
      if (body.estimateHours != null) {
        setEstimateHours(String(body.estimateHours));
        setEstimateSource('ai_suggest');
      }
    } catch (e) {
      setError(errorMessage(e, t('suggestFailed')));
    } finally {
      setBusy(false);
    }
  }, [issueId, t]);

  const logManual = useCallback(async () => {
    setError(null);
    const seconds = parseDuration(manualDuration);
    if (!seconds) {
      setError(t('parseFailed'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds: seconds,
          description: manualNote.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (typeof body.actualHours === 'number') {
        setActualHours(body.actualHours);
      }
      setManualDuration('');
      setManualNote('');
      invalidateIssue();
    } catch (e) {
      setError(errorMessage(e, t('logFailed')));
    } finally {
      setBusy(false);
    }
  }, [invalidateIssue, issueId, manualDuration, manualNote, t]);

  const sourceLabel =
    estimateSource === 'ai_suggest'
      ? t('sourceAi')
      : estimateSource === 'manual'
        ? t('sourceManual')
        : null;

  // Original Estimate / Logged / Remaining trio (Jira parity). The "original
  // estimate" is the value the server has persisted (savedEstimate), not the
  // in-flight edit, so the bar reflects committed state.
  const trio = useMemo(() => {
    const parsed = Number(savedEstimate.trim());
    const original =
      savedEstimate.trim() !== '' && Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    const logged = Math.max(0, actualHours);
    const remaining = Math.max(0, original - logged);
    const over = logged > original;
    // Percent of the bar that's filled (logged vs estimate); capped at 100.
    const percent =
      original > 0 ? Math.min(100, Math.round((logged / original) * 100)) : logged > 0 ? 100 : 0;
    const hasData = original > 0 || logged > 0;
    return { original, logged, remaining, over, percent, hasData };
  }, [savedEstimate, actualHours]);

  const fmtHours = useCallback((value: number) => {
    // Trim trailing zeros: 1.50 -> "1.5", 2.00 -> "2".
    return `${Number(value.toFixed(2))}`;
  }, []);

  return (
    <div className={cn('space-y-3', className)} data-testid="time-tracking-panel">
      {error ? (
        <div className="bg-destructive/10 text-destructive rounded-md px-2 py-1 text-xs">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`tt-est-${issueId}`} className="text-muted-foreground text-xs">
            {t('estimateLabel')}
            {sourceLabel ? ` · ${sourceLabel}` : ''}
          </Label>
          <Input
            id={`tt-est-${issueId}`}
            inputMode="decimal"
            value={estimateHours}
            placeholder="0.0"
            onChange={(e) => {
              setEstimateHours(e.target.value);
              setEstimateSource('manual');
            }}
            onBlur={() => {
              void persistEstimate(estimateSource === 'ai_suggest' ? 'ai_suggest' : 'manual');
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">{t('actualLabel')}</Label>
          <div className="border-border bg-muted/40 rounded-md border px-2 py-1 text-sm tabular-nums">
            {actualHours.toFixed(2)}
          </div>
        </div>
      </div>

      {estimateDirty ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void persistEstimate(estimateSource === 'ai_suggest' ? 'ai_suggest' : 'manual')
          }
          disabled={busy}
        >
          {t('saveEstimate')}
        </Button>
      ) : null}

      {trio.hasData ? (
        <div className="space-y-1.5">
          <div
            className="bg-muted/60 h-1.5 w-full overflow-hidden rounded-sm"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={trio.percent}
            aria-label={`${tTrio('logged', { hours: fmtHours(trio.logged) })} / ${tTrio('originalEstimate', { hours: fmtHours(trio.original) })}`}
          >
            <div
              className={cn(
                'ease-smooth h-full rounded-sm transition-all duration-200',
                trio.over ? 'bg-accent-amber' : 'bg-primary'
              )}
              style={{ width: `${trio.percent}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            {tTrio('logged', { hours: fmtHours(trio.logged) })}
            {' / '}
            {tTrio('originalEstimate', { hours: fmtHours(trio.original) })}
            {trio.over ? (
              <span className="text-accent-amber ml-1">
                {' · '}
                {tTrio('overLogged', { hours: fmtHours(trio.logged - trio.original) })}
              </span>
            ) : (
              <>
                {' · '}
                {tTrio('remaining', { hours: fmtHours(trio.remaining) })}
              </>
            )}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button size="sm" variant="destructive" onClick={stopTimer} disabled={busy}>
            <Square className="mr-1 h-3.5 w-3.5" />
            {t('stopTimer')} {elapsedLabel ? `(${elapsedLabel})` : ''}
          </Button>
        ) : (
          <Button size="sm" onClick={startTimer} disabled={busy}>
            <Play className="mr-1 h-3.5 w-3.5" />
            {t('startTimer')}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={requestAiEstimate} disabled={busy}>
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          {t('aiSuggest')}
        </Button>
      </div>

      {suggestion ? (
        <div className="bg-muted/40 rounded-md px-2 py-1.5 text-xs">
          <div>
            {suggestion.estimateHours != null
              ? t('suggested', { hours: suggestion.estimateHours })
              : t('noSuggestion')}
            {suggestion.p25Hours != null && suggestion.p75Hours != null
              ? ` ${t('suggestedRange', { p25: suggestion.p25Hours, p75: suggestion.p75Hours })}`
              : ''}
          </div>
          <div className="text-muted-foreground mt-0.5">{suggestion.rationale}</div>
        </div>
      ) : null}

      <div className="border-border/60 space-y-2 border-t pt-2">
        <Label className="text-muted-foreground text-xs">{t('logLabel')}</Label>
        <div className="grid gap-2">
          <Input
            placeholder={t('logPlaceholder')}
            value={manualDuration}
            onChange={(e) => setManualDuration(e.target.value)}
            className="h-9 min-w-0"
          />
          <Textarea
            placeholder={t('notePlaceholder')}
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            rows={2}
            className="min-h-16 resize-none"
          />
          <Button
            size="sm"
            onClick={logManual}
            disabled={busy || !manualDuration}
            className="h-8 w-full"
          >
            {t('logButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}
