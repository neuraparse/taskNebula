'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Activity } from 'lucide-react';
import { isToday, isYesterday, startOfDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';

const ACTIVITY_MESSAGE_KEYS = {
  createdIssue: 'activity.messages.createdIssue',
  updatedIssue: 'activity.messages.updatedIssue',
  movedTo: 'activity.messages.movedTo',
  changedStatus: 'activity.messages.changedStatus',
  assignedIssue: 'activity.messages.assignedIssue',
  unassignedIssue: 'activity.messages.unassignedIssue',
  changedPriorityTo: 'activity.messages.changedPriorityTo',
  changedPriority: 'activity.messages.changedPriority',
  commentedOn: 'activity.messages.commentedOn',
  linkedIssue: 'activity.messages.linkedIssue',
  startedSprint: 'activity.messages.startedSprint',
  completedSprint: 'activity.messages.completedSprint',
  createdProject: 'activity.messages.createdProject',
  addedMemberToProject: 'activity.messages.addedMemberToProject',
  unknownAction: 'activity.messages.unknownAction',
} as const;

const ACTIVITY_PRIORITY_KEYS = {
  critical: 'activity.priorities.critical',
  urgent: 'activity.priorities.urgent',
  high: 'activity.priorities.high',
  medium: 'activity.priorities.medium',
  low: 'activity.priorities.low',
  none: 'activity.priorities.none',
} as const;

type ActivityMessageKey = keyof typeof ACTIVITY_MESSAGE_KEYS;
type ActivityPriorityKey = keyof typeof ACTIVITY_PRIORITY_KEYS;
type ActivityTranslationKey =
  | (typeof ACTIVITY_MESSAGE_KEYS)[ActivityMessageKey]
  | (typeof ACTIVITY_PRIORITY_KEYS)[ActivityPriorityKey];
type ActivityTranslator = (
  key: ActivityTranslationKey,
  values?: Record<string, string | number>
) => string;
type IntlFormatter = ReturnType<typeof useFormatter>;

interface ActivityItem {
  id: string;
  action: string;
  type: string;
  message?: string;
  messageKey?: string;
  messageValues?: Record<string, string | number | null | undefined>;
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
  metadata?: unknown;
}

interface ActivityFeedProps {
  organizationId: string;
  limit?: number;
}

function isActivityMessageKey(value: string | undefined): value is ActivityMessageKey {
  return !!value && value in ACTIVITY_MESSAGE_KEYS;
}

function isActivityPriorityKey(value: unknown): value is ActivityPriorityKey {
  return typeof value === 'string' && value in ACTIVITY_PRIORITY_KEYS;
}

function normalizeMessageValues(
  values: ActivityItem['messageValues'],
  t: ActivityTranslator
): Record<string, string | number> {
  const normalized: Record<string, string | number> = {};
  if (!values) return normalized;

  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    if (key === 'priority' && isActivityPriorityKey(value)) {
      normalized[key] = t(ACTIVITY_PRIORITY_KEYS[value]);
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

function activityMessage(activity: ActivityItem, t: ActivityTranslator): string {
  if (isActivityMessageKey(activity.messageKey)) {
    return t(
      ACTIVITY_MESSAGE_KEYS[activity.messageKey],
      normalizeMessageValues(activity.messageValues, t)
    );
  }

  return activity.message ?? t(ACTIVITY_MESSAGE_KEYS.unknownAction, { action: activity.action });
}

function groupLabel(
  d: Date,
  labels: { today: string; yesterday: string },
  formatter: IntlFormatter
): string {
  if (isToday(d)) return labels.today;
  if (isYesterday(d)) return labels.yesterday;
  return formatter.dateTime(d, { dateStyle: 'medium' });
}

function groupByDay(
  activities: ActivityItem[],
  labels: { today: string; yesterday: string },
  formatter: IntlFormatter
) {
  const groups: { key: string; label: string; items: ActivityItem[] }[] = [];
  for (const a of activities) {
    const d = new Date(a.createdAt);
    const key = startOfDay(d).toISOString();
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: groupLabel(d, labels, formatter), items: [] };
      groups.push(group);
    }
    group.items.push(a);
  }
  return groups;
}

export function ActivityFeed({ organizationId, limit = 20 }: ActivityFeedProps) {
  const t = useTranslations('workspaceTools');
  const formatter = useFormatter();
  const { data, isLoading } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ['recent-activities', organizationId, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/activities/recent?organizationId=${organizationId}&limit=${limit}`
      );
      if (!response.ok) throw new Error(t('activity.loadFailed'));
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const activities = useMemo(() => data?.activities ?? [], [data?.activities]);
  const dayLabels = useMemo(
    () => ({ today: t('activity.today'), yesterday: t('activity.yesterday') }),
    [t]
  );
  const groups = useMemo(
    () => groupByDay(activities, dayLabels, formatter),
    [activities, dayLabels, formatter]
  );

  if (isLoading) {
    return (
      <div className="surface-card p-4">
        <div className="mb-4 space-y-0.5">
          <span className="kicker">{t('activity.kicker')}</span>
          <h3 className="text-foreground text-sm font-semibold tracking-tight">
            {t('activity.title')}
          </h3>
        </div>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card p-4">
      <div className="mb-5 flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="kicker">{t('activity.kicker')}</span>
          <h3 className="text-foreground text-sm font-semibold tracking-tight">
            {t('activity.title')}
          </h3>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <Activity className="text-muted-foreground/40 h-7 w-7" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">{t('activity.empty')}</p>
        </div>
      ) : (
        <div className="custom-scrollbar -mr-2 max-h-[560px] space-y-5 overflow-y-auto pr-2">
          {groups.map((group) => (
            <section key={group.key} className="space-y-1.5">
              <span className="kicker">{group.label}</span>
              <ol className="stagger -mx-2">
                {group.items.map((activity) => {
                  const actor =
                    activity.user.name ||
                    activity.user.email.split('@')[0] ||
                    t('activity.someone');
                  const message = activityMessage(activity, t);
                  const initial =
                    (activity.user.name || activity.user.email)[0]?.toUpperCase() || '?';
                  const timestamp = new Date(activity.createdAt);
                  const tooltip = `${actor} ${message}${
                    activity.issue ? ` — ${activity.issue.key} ${activity.issue.title}` : ''
                  } · ${formatter.dateTime(timestamp, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}`;

                  return (
                    <li
                      key={activity.id}
                      className="row-interactive animate-fade-down flex items-center gap-2.5 rounded-md px-2 py-1.5"
                      title={tooltip}
                    >
                      <Avatar className="ring-border h-5 w-5 shrink-0 ring-1">
                        <AvatarImage src={activity.user.image || undefined} alt="" />
                        <AvatarFallback className="text-[9px] font-semibold">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                      <p className="min-w-0 flex-1 truncate text-sm leading-snug">
                        <span className="text-foreground font-medium">{actor}</span>{' '}
                        <span className="text-muted-foreground">{message}</span>
                        {activity.issue && (
                          <>
                            {' '}
                            <span className="text-muted-foreground font-mono text-xs">
                              {activity.issue.key}
                            </span>
                          </>
                        )}
                      </p>
                      <time
                        className="text-muted-foreground shrink-0 text-xs tabular-nums"
                        dateTime={timestamp.toISOString()}
                      >
                        {formatter.relativeTime(timestamp)}
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
