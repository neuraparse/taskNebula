'use client';

import { forwardRef, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  Archive,
  AtSign,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flag,
  GitBranch,
  Link2,
  MessageSquare,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  Notification,
  NotificationType,
} from '@/lib/hooks/use-notifications';

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

/* -------------------------------------------------------------------------- */
/* Type → visual mapping (inline, since notification-visuals.tsx isn't present) */
/* -------------------------------------------------------------------------- */

type TypeVisual = {
  Icon: typeof Bell;
  label: string;
  /** Tailwind classes for the icon badge ring/background/foreground. */
  tone: string;
};

const TYPE_VISUALS: Record<NotificationType, TypeVisual> = {
  mention: {
    Icon: AtSign,
    label: 'Mention',
    tone: 'bg-primary/10 text-primary ring-primary/30',
  },
  comment: {
    Icon: MessageSquare,
    label: 'Comment',
    tone: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/30 dark:text-indigo-300',
  },
  assigned: {
    Icon: UserCheck,
    label: 'Assigned',
    tone: 'bg-violet-500/10 text-violet-600 ring-violet-500/30 dark:text-violet-300',
  },
  status_changed: {
    Icon: Activity,
    label: 'Status',
    tone: 'bg-sky-500/10 text-sky-600 ring-sky-500/30 dark:text-sky-300',
  },
  issue_created: {
    Icon: CheckCircle2,
    label: 'Created',
    tone: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300',
  },
  issue_updated: {
    Icon: GitBranch,
    label: 'Updated',
    tone: 'bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-300',
  },
  issue_linked: {
    Icon: Link2,
    label: 'Linked',
    tone: 'bg-slate-500/10 text-slate-600 ring-slate-500/30 dark:text-slate-300',
  },
  sprint_started: {
    Icon: Flag,
    label: 'Sprint',
    tone: 'bg-fuchsia-500/10 text-fuchsia-600 ring-fuchsia-500/30 dark:text-fuchsia-300',
  },
  sprint_completed: {
    Icon: Flag,
    label: 'Sprint',
    tone: 'bg-fuchsia-500/10 text-fuchsia-600 ring-fuchsia-500/30 dark:text-fuchsia-300',
  },
  ai_draft_failed: {
    Icon: Sparkles,
    label: 'AI draft',
    tone: 'bg-destructive/10 text-destructive ring-destructive/30',
  },
  agent_run_failed: {
    Icon: Bot,
    label: 'Agent',
    tone: 'bg-destructive/10 text-destructive ring-destructive/30',
  },
};

function getTypeVisual(type: NotificationType): TypeVisual {
  return (
    TYPE_VISUALS[type] ?? {
      Icon: Bell,
      label: 'Update',
      tone: 'bg-muted text-muted-foreground ring-border',
    }
  );
}

/** Short reference key (e.g. "ISSUE-abc123") if we have one. */
function getReferenceChip(notification: Notification): string | null {
  if (notification.issueId) {
    const tail = notification.issueId.slice(-6).toUpperCase();
    return `ISSUE-${tail}`;
  }
  if (notification.projectId) {
    const tail = notification.projectId.slice(-6).toUpperCase();
    return `PROJ-${tail}`;
  }
  return null;
}

export function NotificationAvatar({
  notification,
}: {
  notification: Notification;
}) {
  const initial =
    (notification.actor?.name || notification.actor?.email || '?')[0]?.toUpperCase() ??
    '?';
  const visual = getTypeVisual(notification.type);

  // System/AI events: show only the typed icon, no actor avatar.
  if (
    notification.type === 'ai_draft_failed' ||
    notification.type === 'agent_run_failed'
  ) {
    const { Icon } = visual;
    return (
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full ring-1',
          visual.tone
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
    );
  }

  // Actor-driven events: avatar with a small type badge overlay.
  const { Icon } = visual;
  return (
    <span className="relative">
      <Avatar className="h-9 w-9 ring-1 ring-border">
        <AvatarImage src={notification.actor?.image || undefined} alt="" />
        <AvatarFallback className="bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-[11px] font-semibold text-foreground">
          {initial}
        </AvatarFallback>
      </Avatar>
      <span
        aria-hidden="true"
        className={cn(
          'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-background',
          visual.tone
        )}
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Timestamp formatting                                                        */
/* -------------------------------------------------------------------------- */

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'now';
  try {
    // "2h", "3d", "5m" — strict form keeps the row compact.
    return formatDistanceToNowStrict(date, { addSuffix: false })
      .replace(' seconds', 's')
      .replace(' second', 's')
      .replace(' minutes', 'm')
      .replace(' minute', 'm')
      .replace(' hours', 'h')
      .replace(' hour', 'h')
      .replace(' days', 'd')
      .replace(' day', 'd')
      .replace(' months', 'mo')
      .replace(' month', 'mo')
      .replace(' years', 'y')
      .replace(' year', 'y');
  } catch {
    return '';
  }
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
 * Single notification row.
 *
 * Layout (left → right):
 *   [stack toggle] [avatar/icon] [title + body + chips] [time | hover actions] [unread dot]
 *
 * - Clicking the row triggers `onSelect` and auto-marks as read.
 * - When a target href exists, the row is wrapped in a Link so keyboard /
 *   middle-click navigation keeps working.
 * - Hover reveals an inline action bar (mark read/unread, open, snooze, archive).
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
    const visual = getTypeVisual(notification.type);
    const referenceChip = getReferenceChip(notification);
    const isUnread = !notification.isRead;
    const relative = formatRelative(new Date(notification.createdAt));

    const handleRowClick = () => {
      if (isUnread && onMarkRead) onMarkRead(notification.id);
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
        data-unread={isUnread ? 'true' : undefined}
        className={cn(
          'group relative flex items-start gap-3 px-4 py-3 transition-all duration-150 ease-snap',
          'hover:bg-accent/50',
          selected && 'bg-accent/70',
          isUnread && 'bg-gradient-to-r from-primary/[0.04] via-transparent to-transparent',
          compact ? 'gap-2.5 py-2' : 'py-3'
        )}
      >
        {/* Unread left accent bar */}
        {isUnread && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500"
          />
        )}

        {/* Stack toggle slot (keeps row alignment consistent) */}
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
            className={cn(
              'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground',
              'transition-transform duration-150 ease-snap hover:bg-accent hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
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
          <span aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
        )}

        {/* Left: avatar / typed icon */}
        <div className="shrink-0 pt-0.5">
          <NotificationAvatar notification={notification} />
        </div>

        {/* Middle: title, body preview, chips */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                'min-w-0 flex-1 truncate text-sm leading-snug',
                isUnread ? 'text-foreground' : 'text-foreground/90'
              )}
            >
              <span className={cn('font-medium', isUnread && 'font-semibold')}>
                {actorName}
              </span>{' '}
              <span className="text-muted-foreground">
                {notification.title || visual.label.toLowerCase()}
              </span>
            </p>
          </div>

          {notification.message && !compact && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {notification.message}
            </p>
          )}

          {/* Chip row */}
          {(referenceChip || (typeof stackCount === 'number' && stackCount > 1)) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-medium ring-1',
                  visual.tone
                )}
              >
                <visual.Icon className="h-2.5 w-2.5" />
                {visual.label}
              </span>
              {referenceChip && (
                <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-[1px] font-mono text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                  {referenceChip}
                </span>
              )}
              {typeof stackCount === 'number' && stackCount > 1 && (
                <span className="inline-flex items-center rounded-full bg-accent px-1.5 py-[1px] text-[10px] font-medium text-foreground/80 ring-1 ring-border">
                  +{stackCount - 1} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: time + unread dot + hover action bar */}
        <div className="flex shrink-0 items-start gap-2">
          <div className="flex flex-col items-end gap-1">
            <time
              className={cn(
                'text-[11px] tabular-nums transition-opacity duration-150',
                'text-muted-foreground group-hover:opacity-0'
              )}
              dateTime={new Date(notification.createdAt).toISOString()}
              title={new Date(notification.createdAt).toLocaleString()}
            >
              {relative}
            </time>
            {isUnread && (
              <span
                aria-label="Unread"
                className="h-2 w-2 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-[0_0_0_2px_var(--background)] group-hover:opacity-0"
              />
            )}
          </div>

          {/* Hover action bar (absolutely positioned so it doesn't reflow the row) */}
          <div
            className={cn(
              'pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md border bg-popover/95 p-0.5 opacity-0 shadow-sm backdrop-blur',
              'transition-opacity duration-150 ease-snap',
              'group-hover:pointer-events-auto group-hover:opacity-100',
              'focus-within:pointer-events-auto focus-within:opacity-100'
            )}
          >
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
                <Bell className="h-3.5 w-3.5" />
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

            {href && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                aria-label="Open"
                title="Open"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(notification);
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}

            {onSnooze && (
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
            )}

            {onArchive && (
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
            )}
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
