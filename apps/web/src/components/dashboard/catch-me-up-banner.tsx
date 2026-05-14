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
import Link from 'next/link';
import { Loader2, Sparkles, X, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCatchMeUp } from '@/lib/hooks/use-inbox';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function formatGap(lastSeen: Date): string {
  const ms = Date.now() - lastSeen.getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function CatchMeUpBanner() {
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
    <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/[0.04] via-background to-background p-4 shadow-sm animate-fade-up">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Welcome back</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {formatGap(lastSeenDate)} away
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Want a quick summary of what happened while you were gone?
          </p>

          {!expanded ? (
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={() => setExpanded(true)}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Catch me up
              </Button>
              <Link href="/inbox">
                <Button size="sm" variant="ghost">
                  Open inbox
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {isFetching ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Summarizing your inbox…
                </div>
              ) : digest ? (
                <>
                  <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-sans text-xs leading-relaxed text-foreground">
                    {digest.summary_markdown}
                  </pre>
                  {digest.action_items.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Suggested next steps
                      </p>
                      <ul className="space-y-1">
                        {digest.action_items.map((action, idx) => (
                          <li key={`${action.link}-${idx}`}>
                            <Link
                              href={action.link}
                              className={cn(
                                'flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/40',
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
                                {action.urgency}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/70">
                    {digest.source === 'native'
                      ? 'Heuristic summary — connect an Anthropic key in Settings → AI & Agents to upgrade to Claude.'
                      : `Summarized with ${digest.source}.`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No summary available.</p>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
