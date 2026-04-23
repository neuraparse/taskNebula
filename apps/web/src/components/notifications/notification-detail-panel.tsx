'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Archive, Bell, Check, Clock, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Notification } from '@/lib/hooks/use-notifications';
import {
  NotificationAvatar,
  getActorName,
  resolveHref,
  resolveStackKey,
} from './notification-item';

export interface NotificationDetailPanelProps {
  notification: Notification | null;
  related: Notification[];
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onArchive?: (id: string) => void;
  onSnooze?: (id: string) => void;
}

/**
 * Right pane detail view. Shows the selected notification with its full
 * message, related updates on the same entity (the stack history) and quick
 * actions that mirror the per-row hover actions.
 */
export function NotificationDetailPanel({
  notification,
  related,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onSnooze,
}: NotificationDetailPanelProps) {
  if (!notification) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Bell className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Select a notification</p>
          <p className="text-xs text-muted-foreground">
            Pick an item from the left to see the full message and related updates.
          </p>
        </div>
      </div>
    );
  }

  const href = resolveHref(notification);
  const actor = getActorName(notification);
  const stackKey = resolveStackKey(notification);
  const history = related
    .filter((n) => (stackKey ? resolveStackKey(n) === stackKey : n.id === notification.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <NotificationAvatar notification={notification} />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug">{notification.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {actor} &middot;{' '}
              <time dateTime={new Date(notification.createdAt).toISOString()}>
                {format(new Date(notification.createdAt), 'PP p')}
              </time>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {notification.isRead && onMarkUnread ? (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Mark unread"
              title="Mark unread"
              onClick={() => onMarkUnread(notification.id)}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          ) : onMarkRead ? (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Mark read"
              title="Mark read"
              onClick={() => onMarkRead(notification.id)}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Snooze"
            title="Snooze"
            onClick={() => onSnooze?.(notification.id)}
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Archive"
            title="Archive"
            onClick={() => onArchive?.(notification.id)}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
          {href && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="ml-1 h-8 gap-1.5 text-xs"
            >
              <Link href={href}>
                Open
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 px-5 py-4">
          {notification.message && (
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {notification.message}
            </p>
          )}

          {history.length > 1 && (
            <section className="space-y-2">
              <h3 className="kicker text-[11px]">Activity on this item</h3>
              <ul role="list" className="space-y-2">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-sm border border-border/60 bg-muted/20 px-3 py-2"
                  >
                    <p className="text-xs font-medium text-foreground">
                      {getActorName(entry)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.message || entry.title}
                    </p>
                    <time
                      className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground/70"
                      dateTime={new Date(entry.createdAt).toISOString()}
                    >
                      {format(new Date(entry.createdAt), 'PP p')}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
