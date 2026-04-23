'use client';

import { useMemo, useState } from 'react';

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

export interface NotificationStackProps {
  notifications: Notification[];
  selectedId: string | null;
  onSelect: (notification: Notification) => void;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onArchive?: (id: string) => void;
  onSnooze?: (id: string) => void;
}

/**
 * Renders a chronologically-ordered stream of notifications where multiple
 * updates on the same entity collapse into a single parent row.
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
}: NotificationStackProps) {
  const grouped = useMemo(() => groupNotifications(notifications), [notifications]);
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <ul role="list" className="divide-y divide-border/60">
      {grouped.orderedKeys.map((key) => {
        const group = grouped.byKey[key];
        if (!group) return null;
        const parent = group.items[0];
        if (!parent) return null;
        const isStack = group.items.length > 1;
        const open = isStack && !!openKeys[key];

        return (
          <li key={key}>
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
                  'border-l-2 border-border/60 bg-muted/20',
                  'ml-9 divide-y divide-border/40'
                )}
              >
                {group.items.slice(1).map((child) => (
                  <li key={child.id}>
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
      })}
    </ul>
  );
}
