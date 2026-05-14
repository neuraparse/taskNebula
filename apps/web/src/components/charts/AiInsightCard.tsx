'use client';

/**
 * AiInsightCard — single-line "what changed" prompt above a chart that, on
 * click, fetches a short LLM-generated explanation for the chart's recent
 * movement. Results are cached by (metric, period) on the server.
 */

import { useState } from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AiInsightCardProps {
  /** e.g. "velocity", "burndown", "cycle-time", "throughput" */
  metric: string;
  /** e.g. "30d", "current-sprint", "6-sprints" */
  period: string;
  /** Optional scoping ID (projectId / sprintId / organizationId). */
  scopeId?: string | null;
  /** Optional class for outer container. */
  className?: string;
}

interface InsightResponse {
  summary: string;
  cached?: boolean;
  generatedAt?: string;
}

export function AiInsightCard({
  metric,
  period,
  scopeId,
  className,
}: AiInsightCardProps) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ metric, period });
      if (scopeId) params.set('scopeId', scopeId);
      const res = await fetch(`/api/analytics/insight?${params.toString()}`);
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || `Failed (${res.status})`);
      }
      const data = (await res.json()) as InsightResponse;
      setInsight(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch insight');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={fetchInsight}
      disabled={loading}
      aria-label={`Get AI insight for ${metric}`}
      className={cn(
        'group surface-card flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-all duration-150 ease-snap',
        'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : insight ? (
          <Sparkles className="h-3.5 w-3.5" />
        ) : (
          <Wand2 className="h-3.5 w-3.5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        {insight ? (
          <p className="text-xs leading-relaxed text-foreground">
            {insight.summary}
            {insight.cached ? (
              <span className="ml-2 text-[10px] text-muted-foreground">
                · cached
              </span>
            ) : null}
          </p>
        ) : error ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">AI insight</span> —
            click to explain what changed in this chart.
          </p>
        )}
      </div>
    </button>
  );
}
