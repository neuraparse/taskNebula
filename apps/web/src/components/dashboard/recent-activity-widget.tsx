'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Activity as ActivityIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ActivityItem {
  id: string;
  actor: string;
  verbKey:
    | 'commented_on'
    | 'closed'
    | 'opened'
    | 'assigned'
    | 'merged'
    | 'deployed'
    | 'updated_status_on';
  target?: string;
  targetKey?: 'production';
  suffixKey?: 'to_you';
  href?: string;
  at: Date;
}

function relative(
  now: number,
  at: Date,
  t: (key: string, values?: Record<string, number>) => string
): string {
  const diff = Math.max(0, now - at.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return t('activity.ago_seconds', { count: s });
  const m = Math.floor(s / 60);
  if (m < 60) return t('activity.ago_minutes', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('activity.ago_hours', { count: h });
  const d = Math.floor(h / 24);
  return t('activity.ago_days', { count: d });
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
    verbKey: 'commented_on',
    target: 'TN-43',
    href: '/issues/TN-43',
    at: new Date(Date.now() - 7 * 60 * 1000),
  },
  {
    id: 'a2',
    actor: 'Marcus Hill',
    verbKey: 'closed',
    target: 'TN-51',
    href: '/issues/TN-51',
    at: new Date(Date.now() - 35 * 60 * 1000),
  },
  {
    id: 'a3',
    actor: 'Priya Patel',
    verbKey: 'opened',
    target: 'TN-66',
    href: '/issues/TN-66',
    at: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'a4',
    actor: 'Lee Nguyen',
    verbKey: 'assigned',
    target: 'TN-22',
    suffixKey: 'to_you',
    href: '/issues/TN-22',
    at: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: 'a5',
    actor: 'Ana Sousa',
    verbKey: 'merged',
    target: 'PR #128',
    href: '#',
    at: new Date(Date.now() - 9 * 60 * 60 * 1000),
  },
  {
    id: 'a6',
    actor: 'Dev Bot',
    verbKey: 'deployed',
    targetKey: 'production',
    at: new Date(Date.now() - 14 * 60 * 60 * 1000),
  },
  {
    id: 'a7',
    actor: 'Helen Reyes',
    verbKey: 'updated_status_on',
    target: 'TN-07',
    href: '/issues/TN-07',
    at: new Date(Date.now() - 26 * 60 * 60 * 1000),
  },
];

export function RecentActivityWidget() {
  const t = useTranslations('dashboardExtra');
  const tActions = useTranslations('actions');
  const now = Date.now();
  const items = STUB.slice(0, 7);

  return (
    <div className="surface-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-foreground text-sm font-semibold tracking-tight">
          {t('activity.heading')}
        </span>
        <Link
          href="/activity"
          className="text-muted-foreground hover:text-foreground ease-snap inline-flex items-center gap-1 text-xs transition-all duration-150"
        >
          {tActions('view_all')}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <ActivityIcon className="text-muted-foreground mb-2 h-7 w-7" />
          <p className="text-muted-foreground text-sm">{t('empty_no_items')}</p>
          <p className="text-muted-foreground mt-1 text-xs">{t('activity.empty_hint')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-md px-2 py-1.5">
              <Avatar className="mt-0.5 h-6 w-6 shrink-0">
                <AvatarFallback className="text-[10px]">{initials(item.actor)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm leading-tight">
                  {(() => {
                    const target = item.targetKey
                      ? t(`activity.targets.${item.targetKey}`)
                      : (item.target ?? '');

                    return (
                      <>
                        <span className="font-medium">{item.actor}</span>{' '}
                        <span className="text-muted-foreground">
                          {t(`activity.verbs.${item.verbKey}`)}
                        </span>{' '}
                        {item.href ? (
                          <Link href={item.href} className="font-mono text-xs hover:underline">
                            {target}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs">{target}</span>
                        )}
                      </>
                    );
                  })()}
                  {item.suffixKey ? (
                    <>
                      {' '}
                      <span className="text-muted-foreground">
                        {t(`activity.suffixes.${item.suffixKey}`)}
                      </span>
                    </>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-[11px]">{relative(now, item.at, t)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
