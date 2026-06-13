'use client';

import Link from 'next/link';
import { Issue } from '@tasknebula/types';
import { SwipeableItem, swipeActions } from './swipeable-item';
import { PullToRefresh } from './pull-to-refresh';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';

interface MobileIssueListProps {
  issues: Issue[];
  onRefresh: () => Promise<void>;
  onDelete?: (issueId: string) => void;
  onComplete?: (issueId: string) => void;
}

// Left priority indicator colors using design tokens
const priorityIndicatorClass: Record<string, string> = {
  urgent: 'bg-accent-rose',
  high: 'bg-accent-amber',
  medium: 'bg-accent-blue',
  low: 'bg-muted-foreground/30',
  none: 'bg-muted-foreground/20',
};

// Status dot classes
const statusDotClass: Record<string, string> = {
  'To Do': 'status-dot status-idle',
  'In Progress': 'status-dot status-live',
  Done: 'status-dot status-idle opacity-50',
  Blocked: 'status-dot status-danger',
};

export function MobileIssueList({ issues, onRefresh, onDelete, onComplete }: MobileIssueListProps) {
  const t = useTranslations('mobileNav');
  return (
    <PullToRefresh onRefresh={onRefresh} className="h-full">
      <div className="stagger divide-border divide-y">
        {issues.map((issue) => (
          <SwipeableItem
            key={issue.id}
            leftAction={
              onComplete
                ? swipeActions.complete(() => onComplete(issue.id), t('swipeComplete'))
                : undefined
            }
            rightAction={
              onDelete ? swipeActions.delete(() => onDelete(issue.id), t('swipeDelete')) : undefined
            }
          >
            <Link
              href={`/issues/${issue.id}`}
              className="ease-snap hover:bg-accent/50 flex items-stretch transition-all duration-150"
            >
              {/* Left priority indicator bar */}
              <div
                className={cn(
                  'w-1 shrink-0 rounded-r-full',
                  priorityIndicatorClass[issue.priority as keyof typeof priorityIndicatorClass] ||
                    'bg-border'
                )}
                aria-label={t('priorityAria', { priority: issue.priority })}
              />

              {/* Main content */}
              <div className="flex-1 space-y-1.5 px-3 py-3">
                {/* Key + status */}
                <div className="flex items-center gap-2">
                  {issue.status === 'In Progress' ? (
                    <span
                      className="realtime-ping"
                      aria-label={t('statusAria', { status: issue.status })}
                    >
                      <span className="status-dot status-live" />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        statusDotClass[issue.status as keyof typeof statusDotClass] ||
                          'status-dot status-idle'
                      )}
                      aria-label={t('statusAria', { status: issue.status })}
                    />
                  )}
                  <span className="text-muted-foreground font-mono text-[11px]">{issue.key}</span>
                  <span className="text-muted-foreground ml-auto text-[10px]">
                    {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
                  </span>
                </div>

                {/* Title */}
                <p className="line-clamp-2 text-sm font-medium leading-snug">{issue.title}</p>

                {/* Footer */}
                <div className="flex items-center gap-2">
                  {issue.assigneeId && (
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="text-[9px]">?</AvatarFallback>
                    </Avatar>
                  )}
                  {issue.labels && issue.labels.length > 0 && (
                    <div className="flex gap-1">
                      {issue.labels.slice(0, 2).map((label) => (
                        <span key={label} className="chip text-[10px]">
                          {label}
                        </span>
                      ))}
                      {issue.labels.length > 2 && (
                        <span className="chip text-[10px]">+{issue.labels.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </SwipeableItem>
        ))}

        {issues.length === 0 && (
          <div className="text-muted-foreground py-12 text-center text-sm">
            {t('noIssuesFound')}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
