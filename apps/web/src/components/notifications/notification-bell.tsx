'use client';

import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useUnreadNotificationsCount,
  type Notification,
  type NotificationType,
} from '@/lib/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type TabKey = 'all' | 'mentions' | 'unread';

// Subtle left-border hue per notification kind
function getAccentBorder(type: NotificationType): string {
  switch (type) {
    case 'mention':
    case 'comment':
      return 'border-l-accent-violet';
    case 'assigned':
      return 'border-l-accent-blue';
    case 'issue_updated':
    case 'status_changed':
      return 'border-l-accent-amber';
    case 'sprint_completed':
      return 'border-l-accent-emerald';
    case 'issue_created':
    case 'issue_linked':
    case 'sprint_started':
    default:
      return 'border-l-border';
  }
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
  const accent = getAccentBorder(notification.type);
  const actorName = notification.actor?.name || notification.actor?.email?.split('@')[0] || 'Someone';
  const initial =
    (notification.actor?.name || notification.actor?.email || '?')[0]?.toUpperCase() ?? '?';

  const body = (
    <div
      className={cn(
        'relative flex items-start gap-3 px-4 py-3 border-l-2 transition-colors duration-150 hover:bg-accent/40',
        accent,
        !notification.isRead && 'bg-primary/[0.03]'
      )}
    >
      <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border">
        <AvatarImage src={notification.actor?.image || undefined} alt="" />
        <AvatarFallback className="text-[10px] font-semibold">{initial}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug line-clamp-2">
          <span className="font-medium text-foreground">{actorName}</span>{' '}
          <span className="text-muted-foreground">{notification.message || notification.title}</span>
        </p>
        <time
          className="text-xs text-muted-foreground"
          dateTime={new Date(notification.createdAt).toISOString()}
        >
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </time>
      </div>

      {!notification.isRead && (
        <span
          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
          aria-label="Unread"
        />
      )}
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

  const handleMarkAsRead = (id: string) => markAsRead.mutate(id);
  const handleMarkAllAsRead = () => markAllAsRead.mutate();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1 flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        data-state={open ? 'open' : 'closed'}
        className="surface-card shadow-md w-[380px] max-h-[480px] overflow-hidden flex flex-col rounded-lg p-0 animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <span className="text-sm font-semibold tracking-tight">Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleMarkAllAsRead}
            disabled={markAllAsRead.isPending || unreadCount === 0}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark all as read
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex-1 flex flex-col min-h-0">
          <div className="px-4 pb-2">
            <TabsList className="h-8 w-full justify-start gap-1 bg-transparent p-0">
              <TabsTrigger value="all" className="h-7 px-3 text-xs data-[state=active]:bg-accent">
                All
              </TabsTrigger>
              <TabsTrigger value="mentions" className="h-7 px-3 text-xs data-[state=active]:bg-accent">
                Mentions
              </TabsTrigger>
              <TabsTrigger value="unread" className="h-7 px-3 text-xs data-[state=active]:bg-accent">
                Unread
                {unreadCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/10 text-primary text-[10px] px-1.5 py-px">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={tab} className="mt-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                  className="flex items-center justify-center h-24 text-sm text-muted-foreground"
                >
                  <span className="sr-only">Loading notifications</span>
                  Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                  <Inbox className="h-7 w-7 text-muted-foreground/40" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">You&apos;re all caught up</p>
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
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
