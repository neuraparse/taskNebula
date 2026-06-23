'use client';

import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowUpRight, CalendarClock } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useIssues, type Issue } from '@/lib/hooks/use-issues';
import { cn } from '@/lib/utils';

const DAY = 24 * 60 * 60 * 1000;

function dueClass(dueAt: number, now: number): string {
  const diff = dueAt - now;
  if (diff < 0) return 'text-accent-rose';
  if (diff <= 3 * DAY) return 'text-accent-amber';
  return 'text-muted-foreground';
}

type DeadlineFormatter = ReturnType<typeof useFormatter>;

function shortDate(d: Date, formatter: DeadlineFormatter): string {
  return formatter.dateTime(d, { month: 'short', day: 'numeric' });
}

function initials(name: string | null | undefined, email?: string): string {
  if (name) {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

export function UpcomingDeadlinesWidget() {
  const t = useTranslations('dashboardExtra');
  const tActions = useTranslations('actions');
  const formatter = useFormatter();
  const { data: session } = useSession();
  const { data: issues, isLoading } = useIssues({
    assigneeId: session?.user?.id,
  });

  const upcoming = useMemo(() => {
    const now = Date.now();
    const horizon = now + 14 * DAY;
    const all = (issues ?? []) as Issue[];
    return all
      .filter((i) => i.dueDate)
      .map((i) => ({ ...i, _dueAt: new Date(i.dueDate as string).getTime() }))
      .filter((i) => !Number.isNaN(i._dueAt) && i._dueAt <= horizon)
      .sort((a, b) => a._dueAt - b._dueAt)
      .slice(0, 7);
  }, [issues]);

  const now = Date.now();

  return (
    <div className="surface-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-foreground text-sm font-semibold tracking-tight">
          {t('deadlines.heading')}
        </span>
        <Link
          href="/my-issues"
          className="text-muted-foreground hover:text-foreground ease-snap inline-flex items-center gap-1 text-xs transition-all duration-150"
        >
          {tActions('view_all')}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex min-h-[40px] items-center gap-3 rounded-md px-2 py-2">
              <span className="bg-muted h-3 w-14 animate-pulse rounded" />
              <span className="bg-muted h-3 w-12 animate-pulse rounded" />
              <span className="bg-muted h-3 flex-1 animate-pulse rounded" />
              <span className="bg-muted h-6 w-6 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <CalendarClock className="text-muted-foreground mb-2 h-7 w-7" />
          <p className="text-muted-foreground text-sm">{t('empty_no_items')}</p>
          <p className="text-muted-foreground mt-1 text-xs">{t('deadlines.empty_hint')}</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {upcoming.map((issue) => {
            const due = new Date(issue._dueAt);
            const dueCls = dueClass(issue._dueAt, now);
            return (
              <Link
                key={issue.id}
                href={`/issues/${issue.id}`}
                className="row-interactive ease-snap flex min-h-[40px] items-center gap-3 rounded-md px-2 py-2 text-left transition-all duration-150"
              >
                <span className={cn('w-14 shrink-0 text-[11px] font-medium tabular-nums', dueCls)}>
                  {shortDate(due, formatter)}
                </span>
                <span className="text-muted-foreground w-16 shrink-0 truncate font-mono text-xs">
                  {issue.key}
                </span>
                <p className="text-foreground flex-1 truncate text-sm">{issue.title}</p>
                <Avatar className="h-6 w-6 shrink-0">
                  {issue.assignee?.image ? (
                    <AvatarImage
                      src={issue.assignee.image}
                      alt={issue.assignee.name ?? t('deadlines.assignee_alt')}
                    />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {initials(issue.assignee?.name, issue.assignee?.email)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
