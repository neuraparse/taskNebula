'use client';

import { useMemo, useState } from 'react';
import { BellOff } from 'lucide-react';
import { differenceInCalendarDays, isToday, isYesterday } from 'date-fns';

import type { Notification } from '@/lib/hooks/use-notifications';
import { cn } from '@/lib/utils';
import { NotificationItem, resolveStackKey } from './notification-item';

export interface NotificationStackGroup {
  key: string;
  /** Items in chronological order, newest first. */
  items: Notification[];
}

export interface GroupedNotifications {
  /** Stacks of 2+ notifications on the same entity. */
  stacks: NotificationStackGroup[];
  /** Single-item stacks (rendered inline with stacks in their sort order). */
  flatKeys: string[];
  /**
   * Ordered list of stack keys, newest-first by each stack's latest item.
   * Use this to render in chronological order regardless of size.
   */
  orderedKeys: string[];
  byKey: Record<string, NotificationStackGroup>;
}

/**
 * Group notifications by their resolved entity key (issueId / entityId /
 * targetId / workItemId / pageId — whichever exists). Notifications lacking a
 * stackable key are given a synthetic `single:<id>` key so they render as
 * standalone rows without being merged together.
 */
export function groupNotifications(notifications: Notification[]): GroupedNotifications {
  const byKey: Record<string, NotificationStackGroup> = {};
  const order: Array<{ key: string; ts: number }> = [];

  for (const n of notifications) {
    const resolved = resolveStackKey(n);
    const key = resolved ?? `single:${n.id}`;
    const ts = new Date(n.createdAt).getTime();
    const existing = byKey[key];
    if (!existing) {
      byKey[key] = { key, items: [n] };
      order.push({ key, ts });
    } else {
      existing.items.push(n);
      // Track newest timestamp per key for ordering.
      const entry = order.find((o) => o.key === key);
      if (entry && ts > entry.ts) entry.ts = ts;
    }
  }

  for (const key of Object.keys(byKey)) {
    const group = byKey[key];
    if (!group) continue;
    group.items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  order.sort((a, b) => b.ts - a.ts);
  const orderedKeys = order.map((o) => o.key);

  const stacks: NotificationStackGroup[] = [];
  const flatKeys: string[] = [];
  for (const k of orderedKeys) {
    const group = byKey[k];
    if (!group) continue;
    if (group.items.length > 1) stacks.push(group);
    else flatKeys.push(k);
  }

  return { stacks, flatKeys, orderedKeys, byKey };
}

type DayBucket = 'today' | 'yesterday' | 'earlier-week' | 'older';

const BUCKET_LABEL: Record<DayBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  'earlier-week': 'Earlier this week',
  older: 'Older',
};

const BUCKET_ORDER: DayBucket[] = ['today', 'yesterday', 'earlier-week', 'older'];

function getDayBucket(date: Date | string): DayBucket {
  const d = new Date(date);
  if (isToday(d)) return 'today';
  if (isYesterday(d)) return 'yesterday';
  const days = differenceInCalendarDays(new Date(), d);
  if (days <= 6) return 'earlier-week';
  return 'older';
}

export interface NotificationStackProps {
  notifications: Notification[];
  selectedId: string | null;
  onSelect: (notification: Notification) => void;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onArchive?: (id: string) => void;
  onSnooze?: (id: string) => void;
  /**
   * Render loading skeletons instead of items. Optional — existing callers
   * handle loading externally, so omitting this preserves prior behavior.
   */
  loading?: boolean;
}

/**
 * Skeleton row shown while notifications load. Uses a pulsing gradient to
 * match the subtle shimmer idiom used elsewhere in the shell.
 */
function NotificationSkeletonRow() {
  return (
    <div
      aria-hidden="true"
      className="flex items-start gap-3 px-4 py-3 animate-pulse"
    >
      <span className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-muted to-muted/40" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <div className="h-3 w-3/4 rounded-sm bg-gradient-to-r from-muted via-muted/60 to-muted/40" />
        <div className="h-3 w-1/3 rounded-sm bg-gradient-to-r from-muted via-muted/60 to-muted/30" />
      </div>
      <div className="h-3 w-10 shrink-0 rounded-sm bg-muted/50" />
    </div>
  );
}

function NotificationStackLoading({ count = 5 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="divide-y divide-border/50"
    >
      <span className="sr-only">Loading notifications</span>
      {Array.from({ length: count }).map((_, i) => (
        <NotificationSkeletonRow key={i} />
      ))}
    </div>
  );
}

function NotificationStackEmpty() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
        <BellOff className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
      <p className="max-w-[14rem] text-xs text-muted-foreground">
        New mentions and assignments will show here.
      </p>
    </div>
  );
}

/**
 * Renders a chronologically-ordered stream of notifications where multiple
 * updates on the same entity collapse into a single parent row. Items are
 * further partitioned into day buckets ("Today", "Yesterday", "Earlier this
 * week", "Older") for quick scanning.
 *
 * - Parent row shows the latest update + a count of child updates.
 * - Clicking the chevron expands to reveal children in reverse-chronological
 *   order, indented to read as a conversation thread.
 */
export function NotificationStack({
  notifications,
  selectedId,
  onSelect,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onSnooze,
  loading,
}: NotificationStackProps) {
  const grouped = useMemo(() => groupNotifications(notifications), [notifications]);
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  // Bucket stack-keys by their parent (latest) item's day.
  const bucketed = useMemo(() => {
    const map = new Map<DayBucket, string[]>();
    for (const key of grouped.orderedKeys) {
      const group = grouped.byKey[key];
      const parent = group?.items[0];
      if (!parent) continue;
      const bucket = getDayBucket(parent.createdAt);
      const list = map.get(bucket);
      if (list) list.push(key);
      else map.set(bucket, [key]);
    }
    return BUCKET_ORDER.filter((b) => (map.get(b)?.length ?? 0) > 0).map((b) => ({
      bucket: b,
      label: BUCKET_LABEL[b],
      keys: map.get(b)!,
    }));
  }, [grouped]);

  if (loading) {
    return <NotificationStackLoading />;
  }

  if (notifications.length === 0) {
    return <NotificationStackEmpty />;
  }

  const renderRow = (key: string) => {
    const group = grouped.byKey[key];
    if (!group) return null;
    const parent = group.items[0];
    if (!parent) return null;
    const isStack = group.items.length > 1;
    const open = isStack && !!openKeys[key];

    return (
      <li
        key={key}
        tabIndex={-1}
        className={cn(
          'group/row relative transition-colors duration-150 ease-snap',
          'hover:bg-accent/30',
          'focus-within:ring-1 focus-within:ring-ring/40 focus-within:ring-inset'
        )}
      >
        <NotificationItem
          notification={parent}
          selected={selectedId === parent.id}
          showStackToggle={isStack}
          stackCount={isStack ? group.items.length : undefined}
          stackOpen={open}
          onToggleStack={isStack ? () => toggle(key) : undefined}
          onSelect={onSelect}
          onMarkRead={onMarkRead}
          onMarkUnread={onMarkUnread}
          onArchive={onArchive}
          onSnooze={onSnooze}
        />
        {isStack && open && (
          <ul
            role="list"
            className={cn(
              'border-l-2 border-primary/30 bg-muted/20',
              'ml-9 divide-y divide-border/40'
            )}
          >
            {group.items.slice(1).map((child) => (
              <li
                key={child.id}
                tabIndex={-1}
                className="transition-colors duration-150 ease-snap hover:bg-accent/30"
              >
                <NotificationItem
                  notification={child}
                  selected={selectedId === child.id}
                  onSelect={onSelect}
                  onMarkRead={onMarkRead}
                  onMarkUnread={onMarkUnread}
                  onArchive={onArchive}
                  onSnooze={onSnooze}
                  compact
                />
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col">
      {bucketed.map((section, idx) => (
        <section
          key={section.bucket}
          aria-label={section.label}
          className={cn(idx > 0 && 'border-t border-border/60')}
        >
          <div
            className={cn(
              'sticky top-0 z-10 flex items-center gap-2 px-4 py-1.5',
              'bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70',
              'border-b border-border/50'
            )}
          >
            <span className="kicker">{section.label}</span>
            <span className="text-[10px] font-medium text-muted-foreground/70 tabular-nums">
              {section.keys.length}
            </span>
          </div>
          <ul role="list" className="divide-y divide-border/50">
            {section.keys.map((key) => renderRow(key))}
          </ul>
        </section>
      ))}
    </div>
  );
}
