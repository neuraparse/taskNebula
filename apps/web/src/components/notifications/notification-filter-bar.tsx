'use client';

import { CheckCheck, Filter, MoreHorizontal, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type InvolvementFilter =
  | 'all'
  | 'assigned'
  | 'created'
  | 'subscribed'
  | 'mentions';

export type StatusFilter = 'inbox' | 'read' | 'unread' | 'archived' | 'snoozed';

export const INVOLVEMENT_FILTERS: { key: InvolvementFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'created', label: 'Created' },
  { key: 'subscribed', label: 'Subscribed' },
  { key: 'mentions', label: 'Mentions' },
];

export interface NotificationFilterBarProps {
  involvement: InvolvementFilter;
  status: StatusFilter;
  unreadCount: number;
  onInvolvementChange: (value: InvolvementFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  isRefreshing?: boolean;
  markAllDisabled?: boolean;
}

/**
 * Filter chips bar that sits above the notification list.
 *
 * - Involvement chips (All / Assigned / Created / Subscribed / Mentions)
 *   isolate the stream. "Mentions" separates @-tag notifications from other
 *   activity.
 * - Top-right cluster: refresh, mark-all-read, and a 3-dot menu exposing the
 *   Read / Unread / Archived / Snoozed views.
 */
export function NotificationFilterBar({
  involvement,
  status,
  unreadCount,
  onInvolvementChange,
  onStatusChange,
  onRefresh,
  onMarkAllRead,
  isRefreshing,
  markAllDisabled,
}: NotificationFilterBarProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/60 bg-background/60 px-4 pb-2 pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {INVOLVEMENT_FILTERS.map((f) => {
            const active = involvement === f.key;
            return (
              <button
                key={f.key}
                type="button"
                data-active={active ? 'true' : undefined}
                onClick={() => onInvolvementChange(f.key)}
                className={cn(
                  'rounded-sm px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ease-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {f.label}
                {f.key === 'mentions' && active && (
                  <span className="sr-only"> (isolates @-tag notifications)</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label="Refresh notifications"
            title="Refresh"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label="Mark all as read"
            title="Mark all as read"
            onClick={onMarkAllRead}
            disabled={markAllDisabled || unreadCount === 0}
          >
            <CheckCheck className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                aria-label="More filters"
                title="Filters"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Filter className="h-3 w-3" />
                View
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(
                [
                  { key: 'inbox' as const, label: 'Inbox' },
                  { key: 'read' as const, label: 'Read' },
                  { key: 'unread' as const, label: 'Unread' },
                  { key: 'archived' as const, label: 'Archived' },
                  { key: 'snoozed' as const, label: 'Snoozed' },
                ]
              ).map((opt) => (
                <DropdownMenuItem
                  key={opt.key}
                  onSelect={() => onStatusChange(opt.key)}
                  data-active={status === opt.key ? 'true' : undefined}
                  className={cn(
                    status === opt.key && 'bg-accent/60 text-foreground'
                  )}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
