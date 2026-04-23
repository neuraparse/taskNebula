'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BellOff,
  Inbox,
  Settings2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useUnreadNotificationsCount,
  type Notification,
} from '@/lib/hooks/use-notifications';

import {
  NotificationFilterBar,
  type InvolvementFilter,
  type StatusFilter,
} from './notification-filter-bar';
import { NotificationStack } from './notification-stack';
import { NotificationDetailPanel } from './notification-detail-panel';

export interface NotificationsInboxShellProps {
  /**
   * Render inside a popover or card (compact, constrained height) vs. a
   * full-page inbox view (fills its container).
   */
  variant?: 'page' | 'popover';
  className?: string;
  /** Called when a notification is opened, useful for popover auto-close. */
  onOpenNotification?: (notification: Notification) => void;
}

function hasField(n: Notification, field: string): unknown {
  return (n as unknown as Record<string, unknown>)[field];
}

function matchesInvolvement(
  notification: Notification,
  involvement: InvolvementFilter
): boolean {
  if (involvement === 'all') return true;
  if (involvement === 'mentions') {
    return notification.type === 'mention';
  }
  if (involvement === 'assigned') {
    if (notification.type === 'assigned') return true;
    const assignee = hasField(notification, 'assigneeId');
    return typeof assignee === 'string' && assignee.length > 0;
  }
  if (involvement === 'created') {
    const createdBy = hasField(notification, 'createdById');
    const isCreator = hasField(notification, 'isCreator');
    if (typeof isCreator === 'boolean') return isCreator;
    return typeof createdBy === 'string' && createdBy.length > 0;
  }
  if (involvement === 'subscribed') {
    const subscribed = hasField(notification, 'isSubscribed');
    if (typeof subscribed === 'boolean') return subscribed;
    // Fall back: anything that isn't a mention/assignment is "subscribed".
    return notification.type !== 'mention' && notification.type !== 'assigned';
  }
  return true;
}

function matchesStatus(notification: Notification, status: StatusFilter): boolean {
  if (status === 'inbox') {
    const archived = hasField(notification, 'archivedAt') || hasField(notification, 'isArchived');
    const snoozed = hasField(notification, 'snoozedUntil') || hasField(notification, 'isSnoozed');
    return !archived && !snoozed;
  }
  if (status === 'read') return notification.isRead;
  if (status === 'unread') return !notification.isRead;
  if (status === 'archived') {
    const archived = hasField(notification, 'archivedAt') || hasField(notification, 'isArchived');
    return Boolean(archived);
  }
  if (status === 'snoozed') {
    const snoozed = hasField(notification, 'snoozedUntil') || hasField(notification, 'isSnoozed');
    return Boolean(snoozed);
  }
  return true;
}

const PREFERENCES_HREF = '/settings?tab=notifications';

/**
 * Plane-style notifications inbox. Two-pane layout on wide viewports:
 * - Left: filter bar + chronological list with stackable grouped rows.
 * - Right: detail panel for the currently-selected notification.
 *
 * On narrow viewports the shell collapses to a single pane; opening a
 * notification slides the detail panel in with a back button to return to
 * the list.
 *
 * The shell reuses the existing TanStack Query hooks so behavior and polling
 * stay consistent with the bell popover.
 */
export function NotificationsInboxShell({
  variant = 'page',
  className,
  onOpenNotification,
}: NotificationsInboxShellProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isFetching, isError, error, refetch } = useNotifications();
  const unreadCount = useUnreadNotificationsCount();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const [involvement, setInvolvement] = useState<InvolvementFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('inbox');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  const notifications: Notification[] = useMemo(
    () => data?.notifications ?? [],
    [data?.notifications]
  );

  const filtered = useMemo(() => {
    return notifications.filter(
      (n) => matchesInvolvement(n, involvement) && matchesStatus(n, status)
    );
  }, [notifications, involvement, status]);

  // Keep the selected item valid as filters / data change.
  useEffect(() => {
    if (!selectedId) {
      if (filtered[0]) setSelectedId(filtered[0].id);
      return;
    }
    if (!filtered.some((n) => n.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => notifications.find((n) => n.id === selectedId) ?? null,
    [notifications, selectedId]
  );

  const handleSelect = useCallback(
    (notification: Notification) => {
      setSelectedId(notification.id);
      setMobileView('detail');
      if (!notification.isRead) markAsRead.mutate(notification.id);
      onOpenNotification?.(notification);
    },
    [markAsRead, onOpenNotification]
  );

  const handleMarkRead = useCallback(
    (id: string) => {
      markAsRead.mutate(id);
    },
    [markAsRead]
  );

  // Stub: backend endpoint not wired yet — surface intent via toast.
  const handleMarkUnread = useCallback(
    (id: string) => {
      toast({
        title: 'Marked as unread',
        description: 'This will sync once the unread endpoint ships.',
      });
      // eslint-disable-next-line no-console
      console.info('[notifications] mark-unread stub', { id });
    },
    [toast]
  );

  const handleArchive = useCallback(
    (id: string) => {
      toast({
        title: 'Archived',
        description: 'Archive action queued (backend stub).',
      });
      // eslint-disable-next-line no-console
      console.info('[notifications] archive stub', { id });
    },
    [toast]
  );

  const handleSnooze = useCallback(
    (id: string) => {
      toast({
        title: 'Snoozed',
        description: 'Snooze until tomorrow (backend stub).',
      });
      // eslint-disable-next-line no-console
      console.info('[notifications] snooze stub', { id });
    },
    [toast]
  );

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void refetch();
  }, [queryClient, refetch]);

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead.mutate();
  }, [markAllAsRead]);

  const handleResetFilters = useCallback(() => {
    setInvolvement('all');
    setStatus('inbox');
  }, []);

  const emptyCopy = (() => {
    if (involvement === 'mentions') return 'No mentions yet.';
    if (status === 'unread') return 'Nothing unread.';
    if (status === 'read') return 'No read notifications.';
    if (status === 'archived') return 'No archived notifications.';
    if (status === 'snoozed') return 'Nothing snoozed.';
    return 'No notifications yet.';
  })();

  const filtersActive = involvement !== 'all' || status !== 'inbox';
  const hasAnyNotifications = notifications.length > 0;
  const totalCount = notifications.length;

  const isPage = variant === 'page';
  const showingDetailOnMobile = mobileView === 'detail' && !!selected;

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden',
        isPage
          ? 'h-full bg-muted/20 md:p-4 lg:p-6'
          : 'h-[560px] rounded-lg border border-border/60 bg-background',
        className
      )}
    >
      {isPage && (
        <header className="mb-3 flex flex-col gap-3 px-4 pt-4 md:mb-4 md:px-0 md:pt-0 md:flex-row md:items-center md:justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-foreground md:text-2xl">
              Notifications
            </h1>
            {totalCount > 0 && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {totalCount}
                {unreadCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {unreadCount} unread
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link href={PREFERENCES_HREF}>
                <Settings2 className="h-3.5 w-3.5" />
                Preferences
              </Link>
            </Button>
          </div>
        </header>
      )}

      <div
        className={cn(
          'flex min-h-0 flex-1 overflow-hidden border border-border/60 bg-background',
          isPage ? 'rounded-xl shadow-sm mx-4 mb-4 md:mx-0 md:mb-0' : 'rounded-lg'
        )}
      >
        {/* Left pane: list. Hidden on mobile when a detail is active. */}
        <div
          className={cn(
            'flex min-h-0 flex-col border-r border-border/60 md:border-r',
            isPage
              ? 'w-full md:w-[360px] md:shrink-0 lg:w-[400px]'
              : 'w-full md:w-[340px] md:shrink-0',
            showingDetailOnMobile && 'hidden md:flex'
          )}
        >
          <NotificationFilterBar
            involvement={involvement}
            status={status}
            unreadCount={unreadCount}
            onInvolvementChange={setInvolvement}
            onStatusChange={setStatus}
            onRefresh={handleRefresh}
            onMarkAllRead={handleMarkAllRead}
            isRefreshing={isFetching}
            markAllDisabled={markAllAsRead.isPending}
          />

          <ScrollArea className="min-h-0 flex-1">
            {isError ? (
              <InboxErrorState
                message={error instanceof Error ? error.message : undefined}
                onRetry={handleRefresh}
              />
            ) : isLoading ? (
              <InboxListSkeleton />
            ) : filtered.length === 0 ? (
              hasAnyNotifications ? (
                <FilteredEmptyState
                  copy={emptyCopy}
                  onResetFilters={filtersActive ? handleResetFilters : undefined}
                />
              ) : (
                <InboxEmptyState />
              )
            ) : (
              <NotificationStack
                notifications={filtered}
                selectedId={selectedId}
                onSelect={handleSelect}
                onMarkRead={handleMarkRead}
                onMarkUnread={handleMarkUnread}
                onArchive={handleArchive}
                onSnooze={handleSnooze}
              />
            )}
          </ScrollArea>
        </div>

        {/* Right pane: detail. Full-width on mobile when active. */}
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col bg-muted/10',
            showingDetailOnMobile ? 'flex' : 'hidden md:flex'
          )}
        >
          {showingDetailOnMobile && (
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 md:hidden">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="gap-1.5 text-xs"
                onClick={() => setMobileView('list')}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Inbox
              </Button>
            </div>
          )}

          {isError ? (
            <InboxErrorState
              message={error instanceof Error ? error.message : undefined}
              onRetry={handleRefresh}
              variant="panel"
            />
          ) : isLoading ? (
            <InboxDetailSkeleton />
          ) : (
            <NotificationDetailPanel
              notification={selected}
              related={notifications}
              onMarkRead={handleMarkRead}
              onMarkUnread={handleMarkUnread}
              onArchive={handleArchive}
              onSnooze={handleSnooze}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- internal state components ---------------- */

function InboxListSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="divide-y divide-border/60"
    >
      <span className="sr-only">Loading notifications</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

function InboxDetailSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex h-full flex-col"
    >
      <span className="sr-only">Loading notification</span>
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
      <div className="space-y-3 px-5 py-4">
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-10/12" />
        <Skeleton className="h-3 w-8/12" />
        <Skeleton className="h-3 w-9/12" />
      </div>
    </div>
  );
}

function InboxEmptyState() {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <div
        aria-hidden="true"
        className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-transparent ring-1 ring-border/60"
      >
        <Inbox className="h-7 w-7 text-indigo-500" strokeWidth={1.5} />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-violet-500/60 ring-2 ring-background" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">You&apos;re all caught up</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          New mentions, assignments, and activity on items you follow will show up here.
        </p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Link href={PREFERENCES_HREF}>
            <Settings2 className="h-3.5 w-3.5" />
            Notification preferences
          </Link>
        </Button>
      </div>
    </div>
  );
}

function FilteredEmptyState({
  copy,
  onResetFilters,
}: {
  copy: string;
  onResetFilters?: () => void;
}) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 px-8 py-14 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <BellOff className="h-4 w-4" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground">{copy}</p>
      {onResetFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onResetFilters}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

function InboxErrorState({
  message,
  onRetry,
  variant = 'list',
}: {
  message?: string;
  onRetry: () => void;
  variant?: 'list' | 'panel';
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 text-center',
        variant === 'list' ? 'min-h-[280px] py-14' : 'h-full py-16'
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Couldn&apos;t load notifications
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {message || 'Something went wrong while fetching your inbox.'}
        </p>
      </div>
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
