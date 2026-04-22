'use client';

import { useMemo } from 'react';
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

function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-foreground">
          Upcoming deadlines
        </span>
        <Link
          href="/my-issues"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-all duration-150 ease-snap"
        >
          View all
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md px-2 py-2 min-h-[40px]"
            >
              <span className="h-3 w-14 rounded bg-muted animate-pulse" />
              <span className="h-3 w-12 rounded bg-muted animate-pulse" />
              <span className="h-3 flex-1 rounded bg-muted animate-pulse" />
              <span className="h-6 w-6 rounded-full bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <CalendarClock className="h-7 w-7 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No items</p>
          <p className="text-xs text-muted-foreground mt-1">
            Nothing due in the next 14 days.
          </p>
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
                className="row-interactive flex items-center gap-3 rounded-md px-2 py-2 min-h-[40px] text-left transition-all duration-150 ease-snap"
              >
                <span
                  className={cn(
                    'text-[11px] font-medium tabular-nums w-14 shrink-0',
                    dueCls
                  )}
                >
                  {shortDate(due)}
                </span>
                <span className="text-xs font-mono text-muted-foreground shrink-0 w-16 truncate">
                  {issue.key}
                </span>
                <p className="text-sm truncate flex-1 text-foreground">
                  {issue.title}
                </p>
                <Avatar className="h-6 w-6 shrink-0">
                  {issue.assignee?.image ? (
                    <AvatarImage
                      src={issue.assignee.image}
                      alt={issue.assignee.name ?? 'assignee'}
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
