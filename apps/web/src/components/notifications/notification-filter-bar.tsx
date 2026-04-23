'use client';

import { useRef } from 'react';
import { CheckCheck, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type InvolvementFilter =
  | 'all'
  | 'assigned'
  | 'created'
  | 'subscribed'
  | 'mentions';

export type StatusFilter = 'inbox' | 'read' | 'unread' | 'archived' | 'snoozed';

export type NotificationSort = 'newest' | 'oldest' | 'priority';

export const INVOLVEMENT_FILTERS: { key: InvolvementFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'created', label: 'Created' },
  { key: 'subscribed', label: 'Subscribed' },
  { key: 'mentions', label: 'Mentions' },
];

const SORT_OPTIONS: { key: NotificationSort; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'priority', label: 'By priority' },
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

  // v0.2.7 — optional search + sort + results-counter integration. Callers
  // that haven't wired these up yet continue to work; the bar simply omits
  // the search box / counter / sort dropdown when the props are missing.
  search?: string;
  onSearchChange?: (value: string) => void;
  sort?: NotificationSort;
  onSortChange?: (value: NotificationSort) => void;
  totalCount?: number;
}

/**
 * Compact filter + search bar for the notifications inbox.
 *
 * Layout (single row on wide screens, wraps on narrow):
 *   [search] [chips: All / Assigned / Created / Subscribed / Mentions]  [sort] [mark-all] [refresh]
 *
 * The chip row becomes horizontally scrollable on narrow viewports so the
 * segmented control never clips.
 */
export function NotificationFilterBar({
  involvement,
  status,
  unreadCount,
  onInvolvementChange,
  onStatusChange: _onStatusChange,
  onRefresh,
  onMarkAllRead,
  isRefreshing,
  markAllDisabled,
  search,
  onSearchChange,
  sort,
  onSortChange,
  totalCount,
}: NotificationFilterBarProps) {
  // `status` is still consumed by the parent shell; we keep it in the props
  // contract so the shell's filter state stays source-of-truth even though
  // the redesigned bar no longer exposes the legacy status dropdown.
  void status;
  void _onStatusChange;

  const searchRef = useRef<HTMLInputElement | null>(null);
  const showSearch = typeof onSearchChange === 'function';
  const showSort = typeof onSortChange === 'function' && sort !== undefined;
  const hasSearch = typeof search === 'string' && search.trim().length > 0;
  const filtersActive = involvement !== 'all' || hasSearch;
  const showCounter =
    filtersActive && typeof totalCount === 'number' && totalCount > 0;
  const canMarkAllRead = !markAllDisabled && unreadCount > 0;

  return (
    <div className="flex flex-col gap-2 border-b border-border/60 bg-background/60 px-4 pb-2 pt-3">
      {/* Row 1 — search + actions */}
      <div className="flex items-center gap-2">
        {showSearch ? (
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={searchRef}
              type="search"
              value={search ?? ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search notifications…"
              aria-label="Search notifications"
              className="h-8 rounded-sm bg-muted/40 pl-8 pr-2 text-[12px] placeholder:text-muted-foreground/70 focus-visible:bg-background"
            />
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        {showSort ? (
          <Select
            value={sort}
            onValueChange={(v) => onSortChange?.(v as NotificationSort)}
          >
            <SelectTrigger
              aria-label="Sort notifications"
              className="h-8 w-[140px] rounded-sm bg-muted/40 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent align="end" className="min-w-[160px]">
              {SORT_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.key}
                  value={opt.key}
                  className="text-[12px]"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {canMarkAllRead ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onMarkAllRead}
            className="h-8 gap-1.5 rounded-sm px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            aria-label="Mark all as read"
            title="Mark all as read"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mark all read</span>
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Refresh notifications"
          title="Refresh"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')}
          />
        </Button>
      </div>

      {/* Row 2 — segmented chips (horizontally scrollable on narrow) */}
      <div
        role="tablist"
        aria-label="Filter by involvement"
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {INVOLVEMENT_FILTERS.map((f) => {
          const active = involvement === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              data-active={active ? 'true' : undefined}
              onClick={() => onInvolvementChange(f.key)}
              className={cn(
                'shrink-0 rounded-sm px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ease-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
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

        {showCounter ? (
          <span className="ml-auto shrink-0 pl-2 text-[11px] text-muted-foreground">
            {unreadCount} unread of {totalCount}
          </span>
        ) : null}
      </div>
    </div>
  );
}
