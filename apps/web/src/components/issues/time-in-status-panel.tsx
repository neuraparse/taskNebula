'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';

interface Bucket {
  status: string;
  status_name: string;
  status_category: string | null;
  total_duration_seconds: number;
  entered_at_last: string | null;
  exit_count: number;
}

/**
 * Compact panel that surfaces the issue's Time-in-Status breakdown beneath
 * the issue sidebar. The richer visualization (stacked bars, sparklines) is
 * tracked separately in roadmap task #26 — this component is intentionally a
 * minimal numeric summary so the underlying data plumbing can ship first.
 */
export function TimeInStatusPanel({ issueId }: { issueId: string }) {
  const t = useTranslations('issueMisc');
  const tCommon = useTranslations('common');
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBuckets(null);
    setError(null);
    fetch(`/api/issues/${issueId}/time-in-status`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as Bucket[];
      })
      .then((data) => {
        if (!cancelled) setBuckets(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? t('failed_to_load'));
      });
    return () => {
      cancelled = true;
    };
  }, [issueId, t]);

  return (
    <section className="border-border/60 space-y-2 border-t pt-3">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <Clock className="h-3.5 w-3.5" />
        <span>{t('time_in_status_title')}</span>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      {!error && buckets === null && (
        <p className="text-muted-foreground text-xs">{tCommon('loading')}</p>
      )}
      {!error && buckets && buckets.length === 0 && (
        <p className="text-muted-foreground text-xs">{t('no_transitions_recorded')}</p>
      )}
      {!error && buckets && buckets.length > 0 && (
        <ul className="space-y-1">
          {buckets.map((b) => (
            <li key={b.status} className="flex items-center justify-between text-[12px]">
              <span className="text-foreground truncate">{b.status_name}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatDuration(b.total_duration_seconds)}
                {b.exit_count > 0 && (
                  <span className="text-muted-foreground/70 ml-1 text-[10px]">
                    ×{b.exit_count + 1}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
