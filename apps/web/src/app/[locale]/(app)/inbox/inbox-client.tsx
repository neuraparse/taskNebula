'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Bot,
  CheckCheck,
  Clock,
  Inbox as InboxIcon,
  Loader2,
  Sparkles,
  Webhook,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  useInbox,
  useInboxMarkAllRead,
  useInboxMarkRead,
  useInboxSnooze,
  type InboxActorType,
  type InboxFilters,
  type InboxItem,
  type InboxNotificationType,
} from '@/lib/hooks/use-inbox';

const ACTOR_CHIPS: { key: InboxActorType | 'all'; label: string; icon: typeof Bell }[] = [
  { key: 'all', label: 'All', icon: InboxIcon },
  { key: 'user', label: 'People', icon: Bell },
  { key: 'agent', label: 'Agents', icon: Bot },
  { key: 'webhook', label: 'Webhooks', icon: Webhook },
  { key: 'system', label: 'System', icon: Zap },
];

const TYPE_CHIPS: { key: InboxNotificationType | 'all'; label: string }[] = [
  { key: 'all', label: 'Any type' },
  { key: 'mention', label: 'Mentions' },
  { key: 'assignment', label: 'Assignments' },
  { key: 'comment', label: 'Comments' },
  { key: 'status', label: 'Status changes' },
  { key: 'due', label: 'Due / sprint' },
];

const SNOOZE_PRESETS: { label: string; offsetMs: number }[] = [
  { label: '1 hour', offsetMs: 60 * 60 * 1000 },
  { label: '4 hours', offsetMs: 4 * 60 * 60 * 1000 },
  { label: 'Tomorrow', offsetMs: 24 * 60 * 60 * 1000 },
  { label: 'Next week', offsetMs: 7 * 24 * 60 * 60 * 1000 },
];

function getInitial(name: string | null | undefined, email: string | null | undefined) {
  return (name || email || '?')[0]?.toUpperCase() ?? '?';
}

function actorTypeLabel(actorType: InboxActorType): string {
  switch (actorType) {
    case 'agent':
      return 'Agent';
    case 'webhook':
      return 'Webhook';
    case 'system':
      return 'System';
    default:
      return '';
  }
}

function InboxRow({
  item,
  onMarkRead,
  onSnooze,
  isPending,
}: {
  item: InboxItem;
  onMarkRead: (id: string) => void;
  onSnooze: (id: string, untilIso: string | null) => void;
  isPending: boolean;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const actorName =
    item.actor?.name ||
    item.actor?.email?.split('@')[0] ||
    actorTypeLabel(item.actorType) ||
    'Someone';
  const isSnoozed = !!item.snoozedUntil && new Date(item.snoozedUntil).getTime() > Date.now();
  const issueHref = item.issue ? `/issues/${item.issue.id}` : null;

  const handleSnoozeClick = (offsetMs: number) => {
    const until = new Date(Date.now() + offsetMs).toISOString();
    onSnooze(item.id, until);
    setSnoozeOpen(false);
  };

  return (
    <div
      className={cn(
        'border-border group relative flex items-start gap-3 border-b px-4 py-3 transition-colors',
        !item.isRead && 'bg-primary/[0.03]',
        isSnoozed && 'opacity-60'
      )}
      data-actor-type={item.actorType}
      data-unread={!item.isRead || undefined}
    >
      {!item.isRead && (
        <span aria-hidden="true" className="bg-primary absolute bottom-0 left-0 top-0 w-[2px]" />
      )}

      <div className="shrink-0">
        {item.actorType === 'agent' ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/30">
            <Bot className="h-4 w-4" />
          </span>
        ) : item.actorType === 'webhook' ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/30">
            <Webhook className="h-4 w-4" />
          </span>
        ) : item.actorType === 'system' ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/30">
            <Zap className="h-4 w-4" />
          </span>
        ) : (
          <Avatar className="ring-border h-8 w-8 ring-1">
            <AvatarImage src={item.actor?.image || undefined} alt="" />
            <AvatarFallback className="text-[10px] font-semibold">
              {getInitial(item.actor?.name, item.actor?.email)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-foreground font-medium">{actorName}</span>
          {item.project && (
            <span className="bg-muted text-muted-foreground rounded-sm px-1.5 py-0.5 font-mono text-[10px]">
              {item.project.key}
            </span>
          )}
          {item.issue && (
            <Link
              href={issueHref ?? '#'}
              className="text-muted-foreground hover:text-foreground font-mono text-[11px]"
            >
              {item.issue.key}
            </Link>
          )}
          <span className="text-muted-foreground ml-auto text-[11px]">
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{item.title}</p>
        {item.message && item.message !== item.title && (
          <p className="text-muted-foreground/80 mt-0.5 line-clamp-2 text-xs">{item.message}</p>
        )}
        {isSnoozed && (
          <p className="bg-muted/60 text-muted-foreground mt-1 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px]">
            <Clock className="h-3 w-3" />
            Snoozed until {new Date(item.snoozedUntil!).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {!item.isRead && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => onMarkRead(item.id)}
            disabled={isPending}
            aria-label="Mark as read"
          >
            <CheckCheck className="mr-1 h-3 w-3" />
            Read
          </Button>
        )}
        <div className="relative">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => setSnoozeOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={snoozeOpen}
            aria-label="Snooze"
          >
            <Clock className="mr-1 h-3 w-3" />
            Snooze
          </Button>
          {snoozeOpen && (
            <div
              role="menu"
              className="border-border bg-popover absolute right-0 z-10 mt-1 w-36 rounded-md border p-1 shadow-md"
            >
              {SNOOZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSnoozeClick(preset.offsetMs)}
                  className="hover:bg-accent block w-full rounded-sm px-2 py-1 text-left text-xs"
                >
                  {preset.label}
                </button>
              ))}
              {isSnoozed && (
                <>
                  <div className="bg-border my-1 h-px" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSnooze(item.id, null);
                      setSnoozeOpen(false);
                    }}
                    className="hover:bg-accent block w-full rounded-sm px-2 py-1 text-left text-xs"
                  >
                    Unsnooze
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function InboxPageClient() {
  const [actorChip, setActorChip] = useState<InboxActorType | 'all'>('all');
  const [typeChip, setTypeChip] = useState<InboxNotificationType | 'all'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showSnoozed, setShowSnoozed] = useState(false);

  const filters: InboxFilters = useMemo(
    () => ({
      actorType: actorChip === 'all' ? null : actorChip,
      notificationType: typeChip === 'all' ? null : typeChip,
      unread: showUnreadOnly,
      snoozed: showSnoozed,
    }),
    [actorChip, typeChip, showUnreadOnly, showSnoozed]
  );

  const { data, isLoading, isError } = useInbox(filters);
  const snooze = useInboxSnooze();
  const markRead = useInboxMarkRead();
  const markAllRead = useInboxMarkAllRead();

  const items = data?.items ?? [];
  const unreadVisible = items.filter((i) => !i.isRead).length;

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <div className="border-border flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-foreground flex items-center gap-2 text-xl font-semibold">
            <InboxIcon className="h-5 w-5" />
            Inbox
          </h1>
          <p className="text-muted-foreground text-xs">
            Mentions, agent runs, webhooks and system events — unified.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => markAllRead.mutate(filters)}
          disabled={markAllRead.isPending || unreadVisible === 0}
        >
          <CheckCheck className="mr-1 h-3.5 w-3.5" />
          Mark all read
        </Button>
      </div>

      <div
        className="border-border flex flex-wrap items-center gap-1.5 border-b px-6 py-3"
        role="toolbar"
        aria-label="Filter chips"
      >
        {ACTOR_CHIPS.map((chip) => {
          const Icon = chip.icon;
          const active = actorChip === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setActorChip(chip.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary ring-primary/30 ring-1'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
              data-chip={chip.key}
              data-active={active || undefined}
            >
              <Icon className="h-3 w-3" />
              {chip.label}
            </button>
          );
        })}
        <span className="bg-border mx-2 h-4 w-px" aria-hidden="true" />
        {TYPE_CHIPS.map((chip) => {
          const active = typeChip === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTypeChip(chip.key)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs transition-colors',
                active
                  ? 'bg-primary/10 text-primary ring-primary/30 ring-1'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
              data-chip={`type-${chip.key}`}
              data-active={active || undefined}
            >
              {chip.label}
            </button>
          );
        })}
        <span className="bg-border mx-2 h-4 w-px" aria-hidden="true" />
        <button
          type="button"
          role="checkbox"
          aria-checked={showUnreadOnly}
          onClick={() => setShowUnreadOnly((v) => !v)}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs transition-colors',
            showUnreadOnly
              ? 'bg-primary/10 text-primary ring-primary/30 ring-1'
              : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          )}
        >
          Unread only
        </button>
        <button
          type="button"
          role="checkbox"
          aria-checked={showSnoozed}
          onClick={() => setShowSnoozed((v) => !v)}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs transition-colors',
            showSnoozed
              ? 'bg-primary/10 text-primary ring-primary/30 ring-1'
              : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          )}
        >
          Snoozed
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="text-muted-foreground flex h-full items-center justify-center py-20">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading inbox…
          </div>
        ) : isError ? (
          <div className="text-destructive flex h-full items-center justify-center py-20">
            Failed to load inbox. Refresh to try again.
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-20 text-center">
            <Sparkles className="text-muted-foreground h-6 w-6" />
            <p className="text-foreground text-sm font-medium">Nothing here</p>
            <p className="text-muted-foreground max-w-xs text-xs">
              Adjust the filter chips above, or check back later — agent and webhook activity will
              land here as it happens.
            </p>
          </div>
        ) : (
          <ul role="list">
            {items.map((item) => (
              <li key={item.id}>
                <InboxRow
                  item={item}
                  onMarkRead={(id) => markRead.mutate(id)}
                  onSnooze={(id, until) => snooze.mutate({ id, until })}
                  isPending={markRead.isPending || snooze.isPending}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
