'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  type Notification,
} from '@/lib/hooks/use-notifications';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type TabKey = 'all' | 'unread' | 'mentions';

const TABS: { key: TabKey }[] = [{ key: 'all' }, { key: 'unread' }, { key: 'mentions' }];

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
  const t = useTranslations('notifications');
  const actorName =
    notification.type === 'ai_draft_failed'
      ? t('actor.ai_draft')
      : notification.type === 'agent_run_failed'
        ? t('actor.agent_run')
        : notification.actor?.name ||
          notification.actor?.email?.split('@')[0] ||
          t('actor.someone');
  const initial =
    (notification.actor?.name || notification.actor?.email || '?')[0]?.toUpperCase() ?? '?';

  const isMention = notification.type === 'mention' || notification.type === 'comment';

  const body = (
    <div
      className={cn(
        'row-interactive ease-snap relative flex items-start gap-3 px-4 py-3 pr-3 transition-all duration-150',
        !notification.isRead && 'bg-primary/[0.04]'
      )}
    >
      {!notification.isRead && (
        <span
          aria-hidden="true"
          className="from-primary to-primary/60 absolute bottom-0 left-0 top-0 w-[2px] bg-gradient-to-b"
        />
      )}

      <div className={cn('relative shrink-0', !notification.isRead && 'realtime-ping')}>
        {notification.type === 'ai_draft_failed' ? (
          <span className="bg-destructive/10 text-destructive ring-destructive/30 flex h-8 w-8 items-center justify-center rounded-full ring-1">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        ) : notification.type === 'agent_run_failed' ? (
          <span className="bg-destructive/10 text-destructive ring-destructive/30 flex h-8 w-8 items-center justify-center rounded-full ring-1">
            <Bot className="h-3.5 w-3.5" />
          </span>
        ) : (
          <Avatar className="ring-border h-8 w-8 ring-1">
            <AvatarImage src={notification.actor?.image || undefined} alt="" />
            <AvatarFallback className="text-[10px] font-semibold">{initial}</AvatarFallback>
          </Avatar>
        )}
        {isMention && (
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground ring-background absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2"
          >
            <AtSign className="h-2 w-2" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-snug">
          <span className="text-foreground font-medium">{actorName}</span>{' '}
          <span className="text-muted-foreground">
            {notification.message || notification.title}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <time
          className="text-muted-foreground text-[11px] tabular-nums"
          dateTime={new Date(notification.createdAt).toISOString()}
        >
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: false })}
        </time>
        {!notification.isRead && (
          <button
            type="button"
            aria-label={t('row.mark_read')}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            className="text-muted-foreground ease-snap hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[10px] font-medium opacity-0 transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 group-hover/row:opacity-100"
          >
            <Check className="h-3 w-3" />
            {t('row.mark_read')}
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
  const t = useTranslations('notifications');
  const copy: Record<TabKey, { title: string; hint: string; Icon: typeof Inbox }> = {
    all: {
      title: t('bell.empty.all.title'),
      hint: t('bell.empty.all.hint'),
      Icon: Inbox,
    },
    unread: {
      title: t('bell.empty.unread.title'),
      hint: t('bell.empty.unread.hint'),
      Icon: BellOff,
    },
    mentions: {
      title: t('bell.empty.mentions.title'),
      hint: t('bell.empty.mentions.hint'),
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
        className="from-primary/10 to-primary/[0.02] ring-border relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ring-1"
      >
        <Icon className="text-muted-foreground h-5 w-5" />
      </div>
      <p className="text-foreground text-sm font-medium">{title}</p>
      <p className="text-muted-foreground max-w-[220px] text-xs">{hint}</p>
    </div>
  );
}

const DAY_GROUP_KEY: Record<DayGroup, string> = {
  Today: 'today',
  Yesterday: 'yesterday',
  Earlier: 'earlier',
};

export function NotificationBell() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const { data, isLoading } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const notifications = data?.notifications || [];
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );
  const mentionsCount = useMemo(
    () =>
      notifications.filter((n) => (n.type === 'mention' || n.type === 'comment') && !n.isRead)
        .length,
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

  const visible = useMemo(() => filtered.slice(0, LIST_PREVIEW_LIMIT), [filtered]);
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
          className="ease-snap focus-visible:ring-ring relative text-current transition-all duration-150 focus-visible:ring-2"
          aria-label={
            hasUnread
              ? t('bell.trigger_aria_unread', { count: unreadCount })
              : t('bell.trigger_aria')
          }
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Bell
            className={cn('h-4 w-4 transition-transform duration-200', hasUnread && 'text-primary')}
          />
          {hasUnread && (
            <span
              aria-hidden="true"
              key={unreadCount}
              className={cn(
                'absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                'from-primary to-primary/80 text-primary-foreground ring-background bg-gradient-to-br shadow-sm ring-2',
                'animate-pop-in'
              )}
            >
              {displayCount}
            </span>
          )}
          {hasUnread && (
            <span
              aria-hidden="true"
              className="bg-primary/60 absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        role="menu"
        aria-label={t('bell.title')}
        data-state={open ? 'open' : 'closed'}
        className="surface-card animate-pop-in flex max-h-[520px] w-[380px] flex-col overflow-hidden rounded-lg p-0 shadow-lg"
      >
        {/* Header */}
        <div className="border-border/60 flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-foreground text-sm font-semibold">{t('bell.title')}</h2>
            {hasUnread && (
              <span className="chip-accent">{t('bell.new_count', { count: displayCount })}</span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground ease-snap h-7 px-2 text-xs transition-all duration-150"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending || !hasUnread}
              aria-label={t('bell.mark_all_read')}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              {t('bell.mark_all_read')}
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground ease-snap h-7 w-7 transition-all duration-150"
            >
              <Link
                href="/settings?tab=notifications"
                aria-label={t('bell.settings_aria')}
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
          aria-label={t('bell.tabs_aria')}
          className="flex items-center gap-1 px-4 pb-2 pt-2.5"
        >
          {TABS.map((tabItem) => {
            const active = tab === tabItem.key;
            const count =
              tabItem.key === 'unread'
                ? unreadCount
                : tabItem.key === 'mentions'
                  ? mentionsCount
                  : 0;
            return (
              <button
                key={tabItem.key}
                type="button"
                role="tab"
                aria-selected={active}
                data-active={active ? 'true' : undefined}
                onClick={() => setTab(tabItem.key)}
                className={cn(
                  'ease-snap focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2',
                  active
                    ? 'bg-primary/10 text-primary ring-primary/20 ring-1'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {t(`bell.tabs.${tabItem.key}`)}
                {count > 0 && (
                  <span
                    className={cn(
                      'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums',
                      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70'
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
        <ScrollArea className="min-h-0 flex-1">
          {isLoading ? (
            <div role="status" aria-live="polite" aria-busy="true">
              <span className="sr-only">{t('loading')}</span>
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
                  <div className="px-4 pb-1 pt-3">
                    <span className="kicker">{t(`day_group.${DAY_GROUP_KEY[group.label]}`)}</span>
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
          <div className="border-border/60 border-t px-2 py-1.5">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground w-full justify-center text-xs"
            >
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                aria-label={t('bell.view_all_aria')}
              >
                {t('bell.view_all')}
                {hasMore && (
                  <span className="text-muted-foreground/70 ml-1.5">({filtered.length})</span>
                )}
              </Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
