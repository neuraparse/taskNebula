'use client';

import Link from 'next/link';
import { Issue } from '@tasknebula/types';
import { SwipeableItem, swipeActions } from './swipeable-item';
import { PullToRefresh } from './pull-to-refresh';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

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
  'Done': 'status-dot status-idle opacity-50',
  'Blocked': 'status-dot status-danger',
};

export function MobileIssueList({
  issues,
  onRefresh,
  onDelete,
  onComplete,
}: MobileIssueListProps) {
  return (
    <PullToRefresh onRefresh={onRefresh} className="h-full">
      <div className="divide-y divide-border">
        {issues.map((issue) => (
          <SwipeableItem
            key={issue.id}
            leftAction={
              onComplete
                ? swipeActions.complete(() => onComplete(issue.id))
                : undefined
            }
            rightAction={
              onDelete
                ? swipeActions.delete(() => onDelete(issue.id))
                : undefined
            }
          >
            <Link
              href={`/issues/${issue.id}`}
              className="flex items-stretch transition-colors duration-200 hover:bg-accent/50"
            >
              {/* Left priority indicator bar */}
              <div
                className={cn(
                  'w-1 shrink-0 rounded-r-full',
                  priorityIndicatorClass[issue.priority as keyof typeof priorityIndicatorClass] || 'bg-border'
                )}
                aria-label={`Priority: ${issue.priority}`}
              />

              {/* Main content */}
              <div className="flex-1 px-3 py-3 space-y-1.5">
                {/* Key + status */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      statusDotClass[issue.status as keyof typeof statusDotClass] || 'status-dot status-idle'
                    )}
                    aria-label={`Status: ${issue.status}`}
                  />
                  <span className="text-[11px] font-mono text-muted-foreground">{issue.key}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
                  </span>
                </div>

                {/* Title */}
                <p className="line-clamp-2 text-sm font-medium leading-snug">
                  {issue.title}
                </p>

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
          <div className="py-12 text-center text-sm text-muted-foreground">
            No issues found
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
