'use client';

import { forwardRef, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Archive,
  AtSign,
  Bot,
  Check,
  ChevronRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/hooks/use-notifications';

/**
 * Defensive resolver for an entity key we can group by.
 * Notification schemas change; we check several well-known shapes.
 */
export function resolveStackKey(notification: Notification): string | null {
  const n = notification as Notification & Record<string, unknown>;
  const candidates: Array<unknown> = [
    n.issueId,
    n['entityId'],
    n['targetId'],
    n['workItemId'],
    n['pageId'],
    n.projectId,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

export function resolveHref(notification: Notification): string | null {
  if (notification.issueId) return `/issues/${notification.issueId}`;
  if (
    (notification.type === 'ai_draft_failed' ||
      notification.type === 'agent_run_failed') &&
    notification.projectId
  ) {
    return `/projects/${notification.projectId}/settings?tab=ai-agents`;
  }
  return null;
}

export function getActorName(notification: Notification): string {
  if (notification.type === 'ai_draft_failed') return 'AI draft';
  if (notification.type === 'agent_run_failed') return 'Agent run';
  return (
    notification.actor?.name ||
    notification.actor?.email?.split('@')[0] ||
    'Someone'
  );
}

export function NotificationAvatar({ notification }: { notification: Notification }) {
  const initial =
    (notification.actor?.name || notification.actor?.email || '?')[0]?.toUpperCase() ?? '?';

  if (notification.type === 'ai_draft_failed') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (notification.type === 'agent_run_failed') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
        <Bot className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (notification.type === 'mention') {
    return (
      <span className="relative">
        <Avatar className="h-8 w-8 ring-1 ring-border">
          <AvatarImage src={notification.actor?.image || undefined} alt="" />
          <AvatarFallback className="text-[10px] font-semibold">{initial}</AvatarFallback>
        </Avatar>
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
        >
          <AtSign className="h-2 w-2" />
        </span>
      </span>
    );
  }
  return (
    <Avatar className="h-8 w-8 ring-1 ring-border">
      <AvatarImage src={notification.actor?.image || undefined} alt="" />
      <AvatarFallback className="text-[10px] font-semibold">{initial}</AvatarFallback>
    </Avatar>
  );
}

export interface NotificationItemProps {
  notification: Notification;
  selected?: boolean;
  showStackToggle?: boolean;
  stackCount?: number;
  stackOpen?: boolean;
  onToggleStack?: () => void;
  onSelect: (notification: Notification) => void;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onArchive?: (id: string) => void;
  onSnooze?: (id: string) => void;
  compact?: boolean;
}

/**
 * Single notification row. Preserves existing navigation:
 * - Clicking the row triggers `onSelect` which is responsible for navigation
 *   in callers that want it, AND the row itself is wrapped in a Link when a
 *   target href exists so keyboard / middle-click still works.
 * - Hover actions (mark unread, archive, snooze) are action stubs that call
 *   into callbacks supplied by the shell.
 */
export const NotificationItem = forwardRef<HTMLDivElement, NotificationItemProps>(
  function NotificationItem(
    {
      notification,
      selected,
      showStackToggle,
      stackCount,
      stackOpen,
      onToggleStack,
      onSelect,
      onMarkRead,
      onMarkUnread,
      onArchive,
      onSnooze,
      compact,
    },
    ref
  ) {
    const actorName = getActorName(notification);
    const href = resolveHref(notification);

    const handleRowClick = () => {
      if (!notification.isRead && onMarkRead) onMarkRead(notification.id);
      onSelect(notification);
    };

    const handleAction = (
      event: MouseEvent<HTMLButtonElement>,
      fn?: (id: string) => void
    ) => {
      event.preventDefault();
      event.stopPropagation();
      fn?.(notification.id);
    };

    const body: ReactNode = (
      <div
        ref={ref}
        data-selected={selected ? 'true' : undefined}
        className={cn(
          'group relative flex items-start gap-3 px-4 py-3 transition-all duration-150 ease-snap',
          'hover:bg-accent/40',
          selected && 'bg-accent/60',
          !notification.isRead && 'bg-primary/[0.03]',
          compact && 'py-2'
        )}
      >
        {!notification.isRead && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary"
          />
        )}

        {showStackToggle ? (
          <button
            type="button"
            aria-label={stackOpen ? 'Collapse stack' : 'Expand stack'}
            aria-expanded={stackOpen}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleStack?.();
            }}
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-transform duration-150 ease-snap hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-open={stackOpen ? 'true' : undefined}
          >
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-150 ease-snap',
                stackOpen && 'rotate-90'
              )}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        )}

        <div className="shrink-0">
          <NotificationAvatar notification={notification} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug line-clamp-2">
            <span className="font-medium text-foreground">{actorName}</span>{' '}
            <span className="text-muted-foreground">
              {notification.message || notification.title}
            </span>
          </p>
          {typeof stackCount === 'number' && stackCount > 1 && (
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">
              {stackCount} updates
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-start gap-1">
          <time
            className="mt-0.5 text-xs text-muted-foreground tabular-nums group-hover:hidden"
            dateTime={new Date(notification.createdAt).toISOString()}
          >
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: false })}
          </time>

          <div className="hidden items-center gap-0.5 group-hover:flex">
            {notification.isRead && onMarkUnread ? (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                aria-label="Mark unread"
                title="Mark unread"
                onClick={(e) => handleAction(e, onMarkUnread)}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            ) : onMarkRead ? (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                aria-label="Mark read"
                title="Mark read"
                onClick={(e) => handleAction(e, onMarkRead)}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label="Snooze"
              title="Snooze"
              onClick={(e) => handleAction(e, onSnooze)}
            >
              <Clock className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label="Archive"
              title="Archive"
              onClick={(e) => handleAction(e, onArchive)}
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );

    if (href) {
      return (
        <Link
          href={href}
          onClick={handleRowClick}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={handleRowClick}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {body}
      </button>
    );
  }
);
