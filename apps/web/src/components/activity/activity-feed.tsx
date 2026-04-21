'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Activity } from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

interface ActivityItem {
  id: string;
  action: string;
  type: string;
  message: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  issue: {
    id: string;
    key: string;
    title: string;
  } | null;
  createdAt: string | Date;
  metadata?: any;
}

interface ActivityFeedProps {
  organizationId: string;
  limit?: number;
}

function groupLabel(d: Date): string {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d, yyyy');
}

function groupByDay(activities: ActivityItem[]) {
  const groups: { key: string; label: string; items: ActivityItem[] }[] = [];
  for (const a of activities) {
    const d = new Date(a.createdAt);
    const key = startOfDay(d).toISOString();
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: groupLabel(d), items: [] };
      groups.push(group);
    }
    group.items.push(a);
  }
  return groups;
}

export function ActivityFeed({ organizationId, limit = 20 }: ActivityFeedProps) {
  const { data, isLoading } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ['recent-activities', organizationId, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/activities/recent?organizationId=${organizationId}&limit=${limit}`
      );
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const activities = data?.activities || [];
  const groups = useMemo(() => groupByDay(activities), [activities]);

  if (isLoading) {
    return (
      <div className="surface-card p-6">
        <div className="space-y-0.5 mb-4">
          <span className="kicker">Feed</span>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Recent Activity</h3>
        </div>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-0.5">
          <span className="kicker">Feed</span>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Recent Activity</h3>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <Activity className="h-7 w-7 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No recent activity</p>
        </div>
      ) : (
        <div className="max-h-[560px] overflow-y-auto custom-scrollbar -mr-2 pr-2 space-y-5">
          {groups.map((group) => (
            <section key={group.key} className="space-y-1.5">
              <span className="kicker">{group.label}</span>
              <ol className="stagger -mx-2">
                {group.items.map((activity) => {
                  const actor =
                    activity.user.name || activity.user.email.split('@')[0] || 'Someone';
                  const initial =
                    (activity.user.name || activity.user.email)[0]?.toUpperCase() || '?';
                  const timestamp = new Date(activity.createdAt);
                  const tooltip = `${actor} ${activity.message}${
                    activity.issue ? ` — ${activity.issue.key} ${activity.issue.title}` : ''
                  } · ${format(timestamp, 'MMM d, yyyy h:mm a')}`;

                  return (
                    <li
                      key={activity.id}
                      className="row-interactive animate-fade-down flex items-center gap-2.5 px-2 py-1.5 rounded-md"
                      title={tooltip}
                    >
                      <Avatar className="h-5 w-5 shrink-0 ring-1 ring-border">
                        <AvatarImage src={activity.user.image || undefined} alt="" />
                        <AvatarFallback className="text-[9px] font-semibold">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                      <p className="min-w-0 flex-1 truncate text-sm leading-snug">
                        <span className="font-medium text-foreground">{actor}</span>{' '}
                        <span className="text-muted-foreground">{activity.message}</span>
                        {activity.issue && (
                          <>
                            {' '}
                            <span className="font-mono text-xs text-muted-foreground">
                              {activity.issue.key}
                            </span>
                          </>
                        )}
                      </p>
                      <time
                        className="text-xs text-muted-foreground shrink-0 tabular-nums"
                        dateTime={timestamp.toISOString()}
                      >
                        {formatDistanceToNow(timestamp, { addSuffix: true })}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
