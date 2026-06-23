'use client';

// QUAL-21 TS-strict-migration: file untouched intentionally; surfaces 3 errors
// under `exactOptionalPropertyTypes`. See docs/TS_STRICT_MIGRATION.md.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, BellOff, Inbox, Settings2 } from 'lucide-react';
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

function matchesInvolvement(notification: Notification, involvement: InvolvementFilter): boolean {
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
  const t = useTranslations('notifications');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isFetching, isError, error, refetch } = useNotifications();
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
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
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
        title: t('shell.toast.mark_unread_title'),
        description: t('shell.toast.mark_unread_description'),
      });
      // eslint-disable-next-line no-console
      console.info('[notifications] mark-unread stub', { id });
    },
    [toast, t]
  );

  const handleArchive = useCallback(
    (id: string) => {
      toast({
        title: t('shell.toast.archive_title'),
        description: t('shell.toast.archive_description'),
      });
      // eslint-disable-next-line no-console
      console.info('[notifications] archive stub', { id });
    },
    [toast, t]
  );

  const handleSnooze = useCallback(
    (id: string) => {
      toast({
        title: t('shell.toast.snooze_title'),
        description: t('shell.toast.snooze_description'),
      });
      // eslint-disable-next-line no-console
      console.info('[notifications] snooze stub', { id });
    },
    [toast, t]
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
    if (involvement === 'mentions') return t('shell.empty.mentions');
    if (status === 'unread') return t('shell.empty.unread');
    if (status === 'read') return t('shell.empty.read');
    if (status === 'archived') return t('shell.empty.archived');
    if (status === 'snoozed') return t('shell.empty.snoozed');
    return t('shell.empty.default');
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
          ? 'bg-muted/20 h-full md:p-4 lg:p-6'
          : 'border-border/60 bg-background h-[560px] rounded-lg border',
        className
      )}
    >
      {isPage && (
        <header className="mb-3 flex flex-col gap-3 px-4 pt-4 md:mb-4 md:flex-row md:items-center md:justify-between md:px-0 md:pt-0">
          <div className="flex items-baseline gap-3">
            <h1 className="text-foreground text-xl font-semibold tracking-[-0.01em] md:text-2xl">
              {t('shell.title')}
            </h1>
            {totalCount > 0 && (
              <span className="text-muted-foreground text-sm tabular-nums">
                {totalCount}
                {unreadCount > 0 && (
                  <span className="bg-primary/10 text-primary ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium">
                    {t('shell.unread_count', { count: unreadCount })}
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
              className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
            >
              <Link href={PREFERENCES_HREF}>
                <Settings2 className="h-3.5 w-3.5" />
                {t('shell.preferences')}
              </Link>
            </Button>
          </div>
        </header>
      )}

      <div
        className={cn(
          'border-border/60 bg-background flex min-h-0 flex-1 overflow-hidden border',
          isPage ? 'mx-4 mb-4 rounded-xl shadow-sm md:mx-0 md:mb-0' : 'rounded-lg'
        )}
      >
        {/* Left pane: list. Hidden on mobile when a detail is active. */}
        <div
          className={cn(
            'border-border/60 flex min-h-0 flex-col border-r md:border-r',
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
              <InboxErrorState onRetry={handleRefresh} />
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
            'bg-muted/10 flex min-w-0 flex-1 flex-col',
            showingDetailOnMobile ? 'flex' : 'hidden md:flex'
          )}
        >
          {showingDetailOnMobile && (
            <div className="border-border/60 flex items-center gap-2 border-b px-3 py-2 md:hidden">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="gap-1.5 text-xs"
                onClick={() => setMobileView('list')}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t('shell.back_to_inbox')}
              </Button>
            </div>
          )}

          {isError ? (
            <InboxErrorState onRetry={handleRefresh} variant="panel" />
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
  const t = useTranslations('notifications');
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="divide-border/60 divide-y">
      <span className="sr-only">{t('loading')}</span>
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
  const t = useTranslations('notifications');
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex h-full flex-col">
      <span className="sr-only">{t('shell.loading_detail')}</span>
      <div className="border-border/60 flex items-start justify-between gap-3 border-b px-5 py-4">
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
  const t = useTranslations('notifications');
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <div
        aria-hidden="true"
        className="ring-border/60 relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-transparent ring-1"
      >
        <Inbox className="h-7 w-7 text-indigo-500" strokeWidth={1.5} />
        <span className="ring-background absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-violet-500/60 ring-2" />
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-sm font-semibold">{t('shell.empty_state.title')}</p>
        <p className="text-muted-foreground max-w-xs text-xs">{t('shell.empty_state.hint')}</p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Link href={PREFERENCES_HREF}>
            <Settings2 className="h-3.5 w-3.5" />
            {t('shell.empty_state.preferences')}
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
  const t = useTranslations('notifications');
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 px-8 py-14 text-center">
      <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full">
        <BellOff className="h-4 w-4" aria-hidden="true" />
      </div>
      <p className="text-muted-foreground text-sm">{copy}</p>
      {onResetFilters && (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onResetFilters}>
          {t('shell.clear_filters')}
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
  const t = useTranslations('notifications');
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 text-center',
        variant === 'list' ? 'min-h-[280px] py-14' : 'h-full py-16'
      )}
    >
      <div className="bg-destructive/10 text-destructive ring-destructive/30 flex h-10 w-10 items-center justify-center rounded-full ring-1">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">{t('shell.error.title')}</p>
        <p className="text-muted-foreground max-w-xs text-xs">
          {message || t('shell.error.description')}
        </p>
      </div>
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onRetry}>
        {t('shell.error.retry')}
      </Button>
    </div>
  );
}
