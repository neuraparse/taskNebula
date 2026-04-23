'use client';

import Link from 'next/link';
import { ArrowUpRight, Activity as ActivityIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ActivityItem {
  id: string;
  actor: string;
  verb: string;
  target: string;
  href?: string;
  at: Date;
}

function relative(now: number, at: Date): string {
  const diff = Math.max(0, now - at.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const STUB: ActivityItem[] = [
  {
    id: 'a1',
    actor: 'Sarah Chen',
    verb: 'commented on',
    target: 'TN-43',
    href: '/issues/TN-43',
    at: new Date(Date.now() - 7 * 60 * 1000),
  },
  {
    id: 'a2',
    actor: 'Marcus Hill',
    verb: 'closed',
    target: 'TN-51',
    href: '/issues/TN-51',
    at: new Date(Date.now() - 35 * 60 * 1000),
  },
  {
    id: 'a3',
    actor: 'Priya Patel',
    verb: 'opened',
    target: 'TN-66',
    href: '/issues/TN-66',
    at: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'a4',
    actor: 'Lee Nguyen',
    verb: 'assigned',
    target: 'TN-22 to you',
    href: '/issues/TN-22',
    at: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: 'a5',
    actor: 'Ana Sousa',
    verb: 'merged',
    target: 'PR #128',
    href: '#',
    at: new Date(Date.now() - 9 * 60 * 60 * 1000),
  },
  {
    id: 'a6',
    actor: 'Dev Bot',
    verb: 'deployed',
    target: 'production',
    at: new Date(Date.now() - 14 * 60 * 60 * 1000),
  },
  {
    id: 'a7',
    actor: 'Helen Reyes',
    verb: 'updated status on',
    target: 'TN-07',
    href: '/issues/TN-07',
    at: new Date(Date.now() - 26 * 60 * 60 * 1000),
  },
];

export function RecentActivityWidget() {
  const now = Date.now();
  const items = STUB.slice(0, 7);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-foreground">
          Recent activity
        </span>
        <Link
          href="/activity"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-all duration-150 ease-snap"
        >
          View all
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <ActivityIcon className="h-7 w-7 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No items</p>
          <p className="text-xs text-muted-foreground mt-1">
            Activity will appear here as your team works.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-md px-2 py-1.5"
            >
              <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {initials(item.actor)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-tight text-foreground truncate">
                  <span className="font-medium">{item.actor}</span>{' '}
                  <span className="text-muted-foreground">{item.verb}</span>{' '}
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="font-mono text-xs hover:underline"
                    >
                      {item.target}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{item.target}</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {relative(now, item.at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
