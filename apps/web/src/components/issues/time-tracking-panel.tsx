'use client';

/**
 * <TimeTrackingPanel issueId> — task #10 server-backed UI placeholder.
 *
 * Pairs with the new API endpoints:
 *   POST /api/issues/[id]/timer/start
 *   POST /api/issues/[id]/timer/stop
 *   POST /api/issues/[id]/time-entries  (manual log)
 *   POST /api/issues/[id]/ai-estimate
 *
 * Intentionally minimal: estimate field, actual readout, AI-suggest button,
 * timer start/stop, and a small manual-log form. The existing
 * <TimeTrackingLog/> component remains as a localStorage fallback for offline
 * use; this panel speaks to the server.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Play, Square, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  formatDurationSeconds,
  parseDuration,
} from '@/lib/time-tracking/duration';

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

export function TimeTrackingPanel({
  issueId,
  initialEstimateHours = null,
  initialActualHours = null,
  initialEstimateSource = null,
  className,
}: TimeTrackingPanelProps) {
  const [estimateHours, setEstimateHours] = useState<string>(
    initialEstimateHours != null ? String(initialEstimateHours) : '',
  );
  const [estimateSource, setEstimateSource] = useState<string | null>(
    initialEstimateSource,
  );
  const [actualHours, setActualHours] = useState<number>(
    initialActualHours ?? 0,
  );
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
        setError('You already have a running timer.');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setRunning({ id: body.entry.id, startedAt: body.entry.startedAt });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to start timer');
    } finally {
      setBusy(false);
    }
  }, [issueId]);

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
    } catch (e: any) {
      setError(e?.message ?? 'Failed to stop timer');
    } finally {
      setBusy(false);
    }
  }, [issueId]);

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
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fetch estimate');
    } finally {
      setBusy(false);
    }
  }, [issueId]);

  const logManual = useCallback(async () => {
    setError(null);
    const seconds = parseDuration(manualDuration);
    if (!seconds) {
      setError('Could not parse duration. Try "30m" or "1h 15m".');
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
    } catch (e: any) {
      setError(e?.message ?? 'Failed to log time');
    } finally {
      setBusy(false);
    }
  }, [issueId, manualDuration, manualNote]);

  return (
    <div className={cn('space-y-3 rounded-md border p-3', className)} data-testid="time-tracking-panel">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Time tracking</span>
      </div>

      {error ? (
        <div className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`tt-est-${issueId}`} className="text-xs text-muted-foreground">
            Estimate (h){estimateSource ? ` · ${estimateSource}` : ''}
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
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Actual (h)</Label>
          <div className="rounded border bg-muted/40 px-2 py-1 text-sm">
            {actualHours.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button size="sm" variant="destructive" onClick={stopTimer} disabled={busy}>
            <Square className="mr-1 h-3.5 w-3.5" />
            Stop {elapsedLabel ? `(${elapsedLabel})` : ''}
          </Button>
        ) : (
          <Button size="sm" onClick={startTimer} disabled={busy}>
            <Play className="mr-1 h-3.5 w-3.5" />
            Start timer
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={requestAiEstimate} disabled={busy}>
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          AI suggest
        </Button>
      </div>

      {suggestion ? (
        <div className="rounded bg-muted/40 px-2 py-1.5 text-xs">
          <div>
            {suggestion.estimateHours != null
              ? `Suggested ~${suggestion.estimateHours}h`
              : 'No suggestion yet'}
            {suggestion.p25Hours != null && suggestion.p75Hours != null
              ? ` (p25 ${suggestion.p25Hours}h · p75 ${suggestion.p75Hours}h)`
              : ''}
          </div>
          <div className="mt-0.5 text-muted-foreground">{suggestion.rationale}</div>
        </div>
      ) : null}

      <div className="space-y-1 border-t pt-2">
        <Label className="text-xs text-muted-foreground">Log time</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. 30m or 1h 15m"
            value={manualDuration}
            onChange={(e) => setManualDuration(e.target.value)}
            className="w-32"
          />
          <Textarea
            placeholder="What did you do? (optional)"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            rows={1}
            className="flex-1 min-h-[2rem]"
          />
          <Button size="sm" onClick={logManual} disabled={busy || !manualDuration}>
            Log
          </Button>
        </div>
      </div>
    </div>
  );
}
