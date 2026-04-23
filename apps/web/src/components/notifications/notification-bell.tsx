'use client';

import { useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  CheckCheck,
  Check,
  Settings,
  Sparkles,
  Bot,
  AtSign,
  Inbox,
} from 'lucide-react';
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

const LIST_PREVIEW_LIMIT = 8;

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

  const isMention =
    notification.type === 'mention' || notification.type === 'comment';

  const body = (
    <div
      className={cn(
        'row-interactive relative flex items-start gap-3 px-4 py-3 pr-3 transition-all duration-150 ease-snap',
        !notification.isRead && 'bg-primary/[0.04]'
      )}
    >
      {!notification.isRead && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary to-primary/60"
        />
      )}

      <div className={cn('relative shrink-0', !notification.isRead && 'realtime-ping')}>
        {notification.type === 'ai_draft_failed' ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        ) : notification.type === 'agent_run_failed' ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
            <Bot className="h-3.5 w-3.5" />
          </span>
        ) : (
          <Avatar className="h-8 w-8 ring-1 ring-border">
            <AvatarImage src={notification.actor?.image || undefined} alt="" />
            <AvatarFallback className="text-[10px] font-semibold">{initial}</AvatarFallback>
          </Avatar>
        )}
        {isMention && (
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
          >
            <AtSign className="h-2 w-2" />
          </span>
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

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <time
          className="text-[11px] text-muted-foreground tabular-nums"
          dateTime={new Date(notification.createdAt).toISOString()}
        >
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: false })}
        </time>
        {!notification.isRead && (
          <button
            type="button"
            aria-label="Mark read"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            className="inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[10px] font-medium text-muted-foreground opacity-0 transition-all duration-150 ease-snap hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/row:opacity-100"
          >
            <Check className="h-3 w-3" />
            Mark read
          </button>
        )}
      </div>
    </div>
  );

  const handleClick = () => {
    if (!notification.isRead) onMarkRead(notification.id);
    onSelect();
  };

  const interactiveClass =
    'group/row block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  if (notification.issueId) {
    return (
      <Link
        href={`/issues/${notification.issueId}`}
        onClick={handleClick}
        role="menuitem"
        className={interactiveClass}
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
        role="menuitem"
        className={interactiveClass}
      >
        {body}
      </Link>
    );
  }
  // Use role=button on a div so the per-row "Mark read" button can nest
  // inside without producing invalid <button> nesting.
  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={interactiveClass}
    >
      {body}
    </div>
  );
}

function ShimmerRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="shimmer h-8 w-8 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="shimmer h-3 w-3/4 rounded-sm" />
        <div className="shimmer h-3 w-1/3 rounded-sm" />
      </div>
      <div className="shimmer h-3 w-8 rounded-sm" />
    </div>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const copy: Record<TabKey, { title: string; hint: string; Icon: typeof Inbox }> = {
    all: {
      title: 'No notifications yet',
      hint: 'Mentions, updates, and AI run alerts will show up here.',
      Icon: Inbox,
    },
    unread: {
      title: 'You are all caught up',
      hint: 'Nothing unread — nice work staying on top of things.',
      Icon: BellOff,
    },
    mentions: {
      title: 'No mentions yet',
      hint: 'When teammates @mention or comment on you, they appear here.',
      Icon: AtSign,
    },
  };
  const { title, hint, Icon } = copy[tab];
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center"
      role="status"
    >
      <div
        aria-hidden="true"
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/[0.02] ring-1 ring-border"
      >
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-[220px] text-xs text-muted-foreground">{hint}</p>
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
  const mentionsCount = useMemo(
    () =>
      notifications.filter(
        (n) => (n.type === 'mention' || n.type === 'comment') && !n.isRead
      ).length,
    [notifications]
  );

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

  const visible = useMemo(
    () => filtered.slice(0, LIST_PREVIEW_LIMIT),
    [filtered]
  );
  const hasMore = filtered.length > LIST_PREVIEW_LIMIT;

  const grouped = useMemo(() => {
    if (visible.length < 5) return null;
    const groups: Record<DayGroup, Notification[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    for (const n of visible) {
      groups[getDayGroup(n.createdAt)].push(n);
    }
    return (['Today', 'Yesterday', 'Earlier'] as const)
      .filter((k) => groups[k].length > 0)
      .map((k) => ({ label: k, items: groups[k] }));
  }, [visible]);

  const handleMarkAsRead = (id: string) => markAsRead.mutate(id);
  const handleMarkAllAsRead = () => markAllAsRead.mutate();

  // Tests pin the badge cap at "9+".
  const displayCount = unreadCount > 9 ? '9+' : unreadCount;
  const hasUnread = unreadCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative transition-all duration-150 ease-snap focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Notifications${hasUnread ? `, ${unreadCount} unread` : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Bell
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              hasUnread && 'text-foreground'
            )}
          />
          {hasUnread && (
            <span
              aria-hidden="true"
              key={unreadCount}
              className={cn(
                'absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm ring-2 ring-background',
                'animate-pop-in'
              )}
            >
              {displayCount}
            </span>
          )}
          {hasUnread && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary/60 animate-ping"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        role="menu"
        aria-label="Notifications"
        data-state={open ? 'open' : 'closed'}
        className="surface-card shadow-lg w-[380px] max-h-[520px] overflow-hidden flex flex-col rounded-lg p-0 animate-pop-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            {hasUnread && (
              <span className="chip-accent">
                {displayCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-all duration-150 ease-snap"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending || !hasUnread}
              aria-label="Mark all as read"
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark all as read
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground transition-all duration-150 ease-snap"
            >
              <Link
                href="/settings?tab=notifications"
                aria-label="Notification settings"
                onClick={() => setOpen(false)}
              >
                <Settings className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Notification filter"
          className="flex items-center gap-1 px-4 pt-2.5 pb-2"
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            const count =
              t.key === 'unread'
                ? unreadCount
                : t.key === 'mentions'
                  ? mentionsCount
                  : 0;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                data-active={active ? 'true' : undefined}
                onClick={() => setTab(t.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ease-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {t.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground/70'
                    )}
                  >
                    {count > 9 ? '9+' : count}
                  </span>
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
          ) : visible.length === 0 ? (
            <EmptyState tab={tab} />
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
              {visible.map((notification) => (
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

        {/* Footer */}
        {(visible.length > 0 || hasMore) && (
          <div className="border-t border-border/60 px-2 py-1.5">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs text-muted-foreground hover:text-foreground"
            >
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                aria-label="View all notifications"
              >
                View all
                {hasMore && (
                  <span className="ml-1.5 text-muted-foreground/70">
                    ({filtered.length})
                  </span>
                )}
              </Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
