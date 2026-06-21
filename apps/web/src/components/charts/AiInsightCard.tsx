'use client';

/**
 * AiInsightCard — single-line "what changed" prompt above a chart that, on
 * click, fetches a short LLM-generated explanation for the chart's recent
 * movement. Results are cached by (metric, period) on the server.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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

export function AiInsightCard({ metric, period, scopeId, className }: AiInsightCardProps) {
  const t = useTranslations('charts');
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
      setError(err instanceof Error ? err.message : t('insightFetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={fetchInsight}
      disabled={loading}
      aria-label={t('getInsightFor', { metric })}
      className={cn(
        'surface-inset ease-snap group flex w-full items-start gap-3 px-3 py-2 text-left transition-all duration-150',
        'hover:bg-accent/50 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
        className
      )}
    >
      <span className="bg-primary/10 text-primary mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
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
          <p className="text-foreground text-xs leading-relaxed">
            {insight.summary}
            {insight.cached ? (
              <span className="text-muted-foreground ml-2 text-[10px]">· {t('cached')}</span>
            ) : null}
          </p>
        ) : error ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {t.rich('insightPrompt', {
              label: (chunks) => <span className="text-foreground font-medium">{chunks}</span>,
            })}
          </p>
        )}
      </div>
    </button>
  );
}
