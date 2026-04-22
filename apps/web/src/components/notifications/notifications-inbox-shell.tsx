'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { ScrollArea } from '@/components/ui/scroll-area';
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

/**
 * Plane-style notifications inbox. Two-pane layout:
 * - Left: filter bar + chronological list with stackable grouped rows.
 * - Right: detail panel for the currently-selected notification.
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

  const { data, isLoading, isFetching, refetch } = useNotifications();
  const unreadCount = useUnreadNotificationsCount();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const [involvement, setInvolvement] = useState<InvolvementFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('inbox');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const emptyCopy = (() => {
    if (involvement === 'mentions') return 'No mentions yet.';
    if (status === 'unread') return 'Nothing unread.';
    if (status === 'read') return 'No read notifications.';
    if (status === 'archived') return 'No archived notifications.';
    if (status === 'snoozed') return 'Nothing snoozed.';
    return 'No notifications yet.';
  })();

  return (
    <div
      className={cn(
        'flex min-h-0 overflow-hidden rounded-lg border border-border/60 bg-background',
        variant === 'page' ? 'h-full' : 'h-[560px]',
        className
      )}
    >
      {/* Left pane: list */}
      <div
        className={cn(
          'flex min-h-0 flex-col border-r border-border/60',
          variant === 'page' ? 'w-[380px] shrink-0' : 'w-[340px] shrink-0'
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
          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              className="divide-y divide-border/60"
            >
              <span className="sr-only">Loading notifications</span>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="shimmer h-8 w-8 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="shimmer h-3 w-3/4 rounded-sm" />
                    <div className="shimmer h-3 w-1/3 rounded-sm" />
                  </div>
                  <div className="shimmer h-3 w-8 rounded-sm" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <BellOff className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{emptyCopy}</p>
            </div>
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

      {/* Right pane: detail */}
      <div className="flex min-w-0 flex-1 flex-col bg-muted/10">
        <NotificationDetailPanel
          notification={selected}
          related={notifications}
          onMarkRead={handleMarkRead}
          onMarkUnread={handleMarkUnread}
          onArchive={handleArchive}
          onSnooze={handleSnooze}
        />
      </div>
    </div>
  );
}
