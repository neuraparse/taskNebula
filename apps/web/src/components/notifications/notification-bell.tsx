'use client';

import { useMemo, useState } from 'react';
import { Bell, BellOff, CheckCheck, Sparkles, Bot, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useUnreadNotificationsCount,
  type Notification,
} from '@/lib/hooks/use-notifications';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type TabKey = 'all' | 'unread' | 'mentions';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'mentions', label: 'Mentions' },
];

type DayGroup = 'Today' | 'Yesterday' | 'Earlier';

function getDayGroup(date: Date | string): DayGroup {
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return 'Earlier';
}

function NotificationRow({
  notification,
  onSelect,
  onMarkRead,
}: {
  notification: Notification;
  onSelect: () => void;
  onMarkRead: (id: string) => void;
}) {
  const actorName =
    notification.type === 'ai_draft_failed'
      ? 'AI draft'
      : notification.type === 'agent_run_failed'
        ? 'Agent run'
        : notification.actor?.name ||
          notification.actor?.email?.split('@')[0] ||
          'Someone';
  const initial =
    (notification.actor?.name || notification.actor?.email || '?')[0]?.toUpperCase() ??
    '?';

  const body = (
    <div
      className={cn(
        'row-interactive relative flex items-start gap-3 px-4 py-3 pr-3 transition-all duration-150 ease-snap',
        !notification.isRead && 'bg-primary/[0.03]'
      )}
    >
      {!notification.isRead && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary"
        />
      )}

      <div className={cn('relative shrink-0', !notification.isRead && 'realtime-ping')}>
        {notification.type === 'ai_draft_failed' ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        ) : notification.type === 'agent_run_failed' ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
            <Bot className="h-3.5 w-3.5" />
          </span>
        ) : (
          <Avatar className="h-7 w-7 ring-1 ring-border">
            <AvatarImage src={notification.actor?.image || undefined} alt="" />
            <AvatarFallback className="text-[10px] font-semibold">{initial}</AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug line-clamp-2">
          <span className="font-medium text-foreground">{actorName}</span>{' '}
          <span className="text-muted-foreground">
            {notification.message || notification.title}
          </span>
        </p>
      </div>

      <time
        className="shrink-0 text-xs text-muted-foreground tabular-nums"
        dateTime={new Date(notification.createdAt).toISOString()}
      >
        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: false })}
      </time>
    </div>
  );

  const handleClick = () => {
    if (!notification.isRead) onMarkRead(notification.id);
    onSelect();
  };

  if (notification.issueId) {
    return (
      <Link
        href={`/issues/${notification.issueId}`}
        onClick={handleClick}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {body}
      </Link>
    );
  }

  // AI/agent failure notifications deep-link to the project AI settings
  // so the reader can inspect/fix the config that caused the failure.
  if (
    (notification.type === 'ai_draft_failed' || notification.type === 'agent_run_failed') &&
    notification.projectId
  ) {
    return (
      <Link
        href={`/projects/${notification.projectId}/settings?tab=ai-agents`}
        onClick={handleClick}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </button>
  );
}

function ShimmerRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="shimmer h-7 w-7 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="shimmer h-3 w-3/4 rounded-sm" />
        <div className="shimmer h-3 w-1/3 rounded-sm" />
      </div>
      <div className="shimmer h-3 w-8 rounded-sm" />
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const { data, isLoading } = useNotifications();
  const unreadCount = useUnreadNotificationsCount();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const notifications = data?.notifications || [];

  const filtered = useMemo(() => {
    switch (tab) {
      case 'mentions':
        return notifications.filter((n) => n.type === 'mention' || n.type === 'comment');
      case 'unread':
        return notifications.filter((n) => !n.isRead);
      default:
        return notifications;
    }
  }, [notifications, tab]);

  const grouped = useMemo(() => {
    if (filtered.length < 5) return null;
    const groups: Record<DayGroup, Notification[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    for (const n of filtered) {
      groups[getDayGroup(n.createdAt)].push(n);
    }
    return (['Today', 'Yesterday', 'Earlier'] as const).filter(
      (k) => groups[k].length > 0
    ).map((k) => ({ label: k, items: groups[k] }));
  }, [filtered]);

  const emptyCopy: Record<TabKey, string> = {
    all: 'No notifications yet.',
    unread: 'Nothing unread.',
    mentions: 'No mentions yet.',
  };

  const handleMarkAsRead = (id: string) => markAsRead.mutate(id);
  const handleMarkAllAsRead = () => markAllAsRead.mutate();

  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative transition-all duration-150 ease-snap"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              key={unreadCount}
              className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1 flex items-center justify-center animate-pop-in"
            >
              {displayCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        data-state={open ? 'open' : 'closed'}
        className="surface-card shadow-md w-96 max-h-[480px] overflow-hidden flex flex-col rounded-lg p-0 animate-pop-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="kicker">Notifications</span>
            <span
              className={cn(
                'text-[11px] font-medium px-2 py-0.5 rounded-sm',
                unreadCount > 0
                  ? 'chip-accent'
                  : 'chip'
              )}
            >
              {unreadCount > 0 ? `${displayCount} new` : '0'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-all duration-150 ease-snap"
            onClick={handleMarkAllAsRead}
            disabled={markAllAsRead.isPending || unreadCount === 0}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 px-4 pb-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                data-active={active ? 'true' : undefined}
                onClick={() => setTab(t.key)}
                className={cn(
                  'text-[11px] font-medium px-2.5 py-1 rounded-sm transition-all duration-150 ease-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'chip-accent' : 'chip hover:text-foreground'
                )}
              >
                {t.label}
                {t.key === 'unread' && unreadCount > 0 && (
                  <span className="ml-1.5 tabular-nums">{displayCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div role="status" aria-live="polite" aria-busy="true">
              <span className="sr-only">Loading notifications</span>
              <ShimmerRow />
              <ShimmerRow />
              <ShimmerRow />
              <ShimmerRow />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <BellOff className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{emptyCopy[tab]}</p>
            </div>
          ) : grouped ? (
            <div>
              {grouped.map((group) => (
                <section key={group.label}>
                  <div className="px-4 pt-3 pb-1">
                    <span className="kicker">{group.label}</span>
                  </div>
                  <ul role="list" className="stagger">
                    {group.items.map((notification) => (
                      <li key={notification.id} className="animate-fade-up">
                        <NotificationRow
                          notification={notification}
                          onSelect={() => setOpen(false)}
                          onMarkRead={handleMarkAsRead}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul role="list" className="stagger">
              {filtered.map((notification) => (
                <li key={notification.id} className="animate-fade-up">
                  <NotificationRow
                    notification={notification}
                    onSelect={() => setOpen(false)}
                    onMarkRead={handleMarkAsRead}
                  />
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
