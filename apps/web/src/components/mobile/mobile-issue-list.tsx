'use client';

import Link from 'next/link';
import { Issue } from '@tasknebula/types';
import { SwipeableItem, swipeActions } from './swipeable-item';
import { PullToRefresh } from './pull-to-refresh';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  Circle,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';

interface MobileIssueListProps {
  issues: Issue[];
  onRefresh: () => Promise<void>;
  onDelete?: (issueId: string) => void;
  onComplete?: (issueId: string) => void;
}

const priorityIcons = {
  urgent: <ArrowUp className="h-3 w-3 text-red-500" />,
  high: <ArrowUp className="h-3 w-3 text-orange-500" />,
  medium: <Minus className="h-3 w-3 text-yellow-500" />,
  low: <ArrowDown className="h-3 w-3 text-blue-500" />,
  none: <Minus className="h-3 w-3 text-gray-400" />,
};

const statusIcons = {
  'To Do': <Circle className="h-4 w-4 text-gray-400" />,
  'In Progress': <Circle className="h-4 w-4 fill-blue-500 text-blue-500" />,
  Done: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  Blocked: <AlertCircle className="h-4 w-4 text-red-500" />,
};

export function MobileIssueList({
  issues,
  onRefresh,
  onDelete,
  onComplete,
}: MobileIssueListProps) {
  return (
    <PullToRefresh onRefresh={onRefresh} className="h-full">
      <div className="divide-y">
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
              className="block px-4 py-3 hover:bg-muted/50 active:bg-muted"
            >
              <div className="space-y-2">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {statusIcons[issue.status as keyof typeof statusIcons] || (
                      <Circle className="h-4 w-4" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {issue.key}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {priorityIcons[issue.priority as keyof typeof priorityIcons]}
                  </div>
                </div>

                {/* Title */}
                <h3 className="line-clamp-2 text-sm font-medium leading-tight">
                  {issue.title}
                </h3>

                {/* Description */}
                {issue.description && (
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {issue.description}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Assignee */}
                    {issue.assigneeId && (
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="text-[10px]">
                          ?
                        </AvatarFallback>
                      </Avatar>
                    )}

                    {/* Labels */}
                    {issue.labels && issue.labels.length > 0 && (
                      <div className="flex gap-1">
                        {issue.labels.slice(0, 2).map((label) => (
                          <Badge
                            key={label}
                            variant="secondary"
                            className="h-4 px-1 text-[10px]"
                          >
                            {label}
                          </Badge>
                        ))}
                        {issue.labels.length > 2 && (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1 text-[10px]"
                          >
                            +{issue.labels.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Updated time */}
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(issue.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
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

