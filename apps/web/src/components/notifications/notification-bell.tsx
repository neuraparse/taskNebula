'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
  useUnreadNotificationsCount,
} from '@/lib/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'mention':
    case 'comment':
      return 'message';
    case 'assigned':
      return 'user';
    case 'status_changed':
      return 'refresh';
    case 'issue_created':
    case 'issue_updated':
    case 'issue_linked':
      return 'issue';
    case 'sprint_started':
    case 'sprint_completed':
      return 'sprint';
    default:
      return 'bell';
  }
}

function NotificationTypeIcon({ type }: { type: string }) {
  const kind = getNotificationIcon(type);
  // Use a single small dot color per semantic type for minimal, non-emoji markers
  const colorMap: Record<string, string> = {
    message: 'bg-accent-blue/80',
    user: 'bg-accent-violet/80',
    refresh: 'bg-accent-amber/80',
    issue: 'bg-primary/60',
    sprint: 'bg-accent-emerald/80',
    bell: 'bg-muted-foreground/40',
  };
  return (
    <span
      className={cn(
        'mt-1 h-2 w-2 shrink-0 rounded-full',
        colorMap[kind] ?? 'bg-muted-foreground/40'
      )}
      aria-hidden="true"
    />
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useNotifications();
  const unreadCount = useUnreadNotificationsCount();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();

  const notifications = data?.notifications || [];

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const handleDelete = (notificationId: string) => {
    deleteNotification.mutate(notificationId);
  };

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
              className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1 flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        data-state={open ? 'open' : 'closed'}
        className="surface-card shadow-lg w-96 rounded-lg p-0 overflow-hidden animate-scale-in"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Body */}
        <ScrollArea className="h-[400px]">
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
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Bell className="h-8 w-8 text-muted-foreground opacity-40" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-border/50">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={cn(
                    'group relative flex items-start gap-3 px-4 py-3 transition-colors duration-200 hover:bg-accent/50 min-h-[48px]',
                    !notification.isRead && 'bg-primary/5 border-l-2 border-primary'
                  )}
                >
                  <NotificationTypeIcon type={notification.type} />

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-medium leading-snug truncate">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                      {notification.actor && (
                        <>
                          <span>{notification.actor.name}</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <time dateTime={new Date(notification.createdAt).toISOString()}>
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </time>
                    </div>
                  </div>

                  {/* Row actions — visible on hover */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {notification.issueId && (
                      <Link href={`/issues/${notification.issueId}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label="View issue"
                          onClick={() => setOpen(false)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        aria-label="Mark as read"
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={markAsRead.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      aria-label="Delete notification"
                      onClick={() => handleDelete(notification.id)}
                      disabled={deleteNotification.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
