'use client';

/**
 * "Welcome back" banner.
 *
 * Logic:
 *   1. On mount, GET `/api/user/last-seen` to read the previous timestamp.
 *   2. If it's been > 4 hours, show the banner.
 *   3. POST `/api/user/last-seen` to advance the stamp so we don't re-show
 *      on every navigation within the session.
 *   4. When the user clicks "Catch me up", lazily fetch
 *      `/api/inbox/catch-me-up?since=<previous lastSeen>` and render the
 *      AI digest + action items inline.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Loader2, Sparkles, X, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCatchMeUp } from '@/lib/hooks/use-inbox';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function formatGap(
  lastSeen: Date,
  t: (key: string, values?: Record<string, number>) => string
): string {
  const ms = Date.now() - lastSeen.getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 24) return t('catchup.gap_hours', { count: hours });
  const days = Math.floor(hours / 24);
  return t('catchup.gap_days', { count: days });
}

export function CatchMeUpBanner() {
  const t = useTranslations('dashboardExtra');
  const [previousLastSeen, setPreviousLastSeen] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch('/api/user/last-seen');
        if (!response.ok) {
          if (!cancelled) setReady(true);
          return;
        }
        const data = (await response.json()) as { lastSeenAt: string | null };
        if (cancelled) return;
        if (data.lastSeenAt) {
          const gap = Date.now() - new Date(data.lastSeenAt).getTime();
          if (gap > FOUR_HOURS_MS) {
            setPreviousLastSeen(data.lastSeenAt);
          }
        }
        // Advance the stamp regardless so we don't re-fire on every tab change.
        await fetch('/api/user/last-seen', { method: 'POST' });
      } catch {
        // Silent failure — banner stays hidden.
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: digest, isFetching } = useCatchMeUp({
    since: previousLastSeen,
    enabled: expanded && !!previousLastSeen,
  });

  if (!ready || !previousLastSeen || dismissed) return null;

  const lastSeenDate = new Date(previousLastSeen);

  return (
    <div className="border-primary/30 from-primary/[0.04] via-background to-background animate-fade-up rounded-lg border bg-gradient-to-br p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary ring-primary/20 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-foreground text-sm font-semibold">{t('catchup.welcome_back')}</h2>
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]">
              <Clock className="h-2.5 w-2.5" />
              {t('catchup.away', { gap: formatGap(lastSeenDate, t) })}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{t('catchup.prompt')}</p>

          {!expanded ? (
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={() => setExpanded(true)}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {t('catchup.catch_me_up')}
              </Button>
              <Link href="/inbox">
                <Button size="sm" variant="ghost">
                  {t('catchup.open_inbox')}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {isFetching ? (
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('catchup.summarizing')}
                </div>
              ) : digest ? (
                <>
                  <pre className="bg-muted/40 text-foreground whitespace-pre-wrap rounded-md p-3 font-sans text-xs leading-relaxed">
                    {digest.summary_markdown}
                  </pre>
                  {digest.action_items.length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">
                        {t('catchup.suggested_next_steps')}
                      </p>
                      <ul className="space-y-1">
                        {digest.action_items.map((action, idx) => (
                          <li key={`${action.link}-${idx}`}>
                            <Link
                              href={action.link}
                              className={cn(
                                'border-border bg-background hover:bg-muted/40 flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                                action.urgency === 'high' && 'border-rose-500/30',
                                action.urgency === 'medium' && 'border-amber-500/30'
                              )}
                            >
                              <span className="truncate">{action.title}</span>
                              <span
                                className={cn(
                                  'ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase',
                                  action.urgency === 'high' && 'bg-rose-500/10 text-rose-600',
                                  action.urgency === 'medium' && 'bg-amber-500/10 text-amber-700',
                                  action.urgency === 'low' && 'bg-muted text-muted-foreground'
                                )}
                              >
                                {t(`catchup.urgency.${action.urgency}`)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-muted-foreground/70 text-[10px]">
                    {digest.source === 'native'
                      ? t('catchup.source_native')
                      : t('catchup.source_other', { source: digest.source })}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">{t('catchup.no_summary')}</p>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setDismissed(true)}
          aria-label={t('catchup.dismiss')}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
