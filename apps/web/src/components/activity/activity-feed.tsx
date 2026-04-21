'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  MessageSquare,
  CheckCircle2,
  UserPlus,
  Link2,
  Rocket,
  Trophy,
  Activity,
  Plus,
  Edit,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

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

type DotHue = 'emerald' | 'blue' | 'violet' | 'amber' | 'cyan' | 'rose';

function getDotHue(type: string): DotHue {
  switch (type) {
    case 'status_change':
    case 'sprint_completed':
      return 'emerald';
    case 'comment':
      return 'blue';
    case 'assigned':
      return 'violet';
    case 'linked':
      return 'cyan';
    case 'sprint_started':
      return 'amber';
    case 'created':
      return 'emerald';
    case 'updated':
      return 'amber';
    default:
      return 'blue';
  }
}

const dotHueClass: Record<DotHue, string> = {
  emerald: 'bg-accent-emerald',
  blue: 'bg-accent-blue',
  violet: 'bg-accent-violet',
  amber: 'bg-accent-amber',
  cyan: 'bg-accent-cyan',
  rose: 'bg-accent-rose',
};

function getActivityIcon(type: string) {
  const cls = 'h-3.5 w-3.5';
  switch (type) {
    case 'comment':
      return <MessageSquare className={cn(cls, 'text-accent-blue')} />;
    case 'status_change':
      return <CheckCircle2 className={cn(cls, 'text-accent-emerald')} />;
    case 'assigned':
      return <UserPlus className={cn(cls, 'text-accent-violet')} />;
    case 'linked':
      return <Link2 className={cn(cls, 'text-accent-cyan')} />;
    case 'sprint_started':
      return <Rocket className={cn(cls, 'text-accent-amber')} />;
    case 'sprint_completed':
      return <Trophy className={cn(cls, 'text-accent-emerald')} />;
    case 'created':
      return <Plus className={cn(cls, 'text-accent-emerald')} />;
    case 'updated':
      return <Edit className={cn(cls, 'text-accent-amber')} />;
    default:
      return <Activity className={cn(cls, 'text-muted-foreground')} />;
  }
}

export function ActivityFeed({ organizationId, limit = 20 }: ActivityFeedProps) {
  const { data, isLoading } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ['recent-activities', organizationId, limit],
    queryFn: async () => {
      const response = await fetch(`/api/activities/recent?organizationId=${organizationId}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const activities = data?.activities || [];

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
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-0.5">
          <span className="kicker">Feed</span>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Recent Activity</h3>
        </div>
        {activities.length > 0 && (
          <span className="chip">{activities.length}</span>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <Activity className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No recent activity</p>
        </div>
      ) : (
        <div className="stagger max-h-[560px] overflow-y-auto custom-scrollbar -mr-2 pr-2">
          {activities.map((activity, i) => {
            const hue = getDotHue(activity.type);
            const isLast = i === activities.length - 1;
            return (
              <div
                key={activity.id}
                className="animate-fade-up flex gap-3 group"
              >
                {/* Timeline column */}
                <div className="flex flex-col items-center pt-1 shrink-0">
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0 mt-1', dotHueClass[hue])} />
                  {!isLast && (
                    <span className="w-px flex-1 border-l border-border mt-1.5 mb-0" />
                  )}
                </div>

                {/* Content */}
                <div className="flex gap-2.5 pb-4 flex-1 min-w-0">
                  <Avatar className="h-6 w-6 shrink-0 ring-1 ring-border mt-0.5">
                    <AvatarImage src={activity.user.image || undefined} />
                    <AvatarFallback className="text-[10px] font-semibold">
                      {activity.user.name?.[0]?.toUpperCase() || activity.user.email[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-start gap-1.5">
                      {getActivityIcon(activity.type)}
                      <span className="text-sm leading-snug flex-1">
                        <span className="font-medium text-foreground">
                          {activity.user.name || activity.user.email.split('@')[0]}
                        </span>{' '}
                        <span className="text-muted-foreground">{activity.message}</span>
                      </span>
                    </div>

                    {activity.issue && (
                      <div className="flex items-center gap-1.5 pl-5">
                        <span className="chip font-mono">{activity.issue.key}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {activity.issue.title}
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground pl-5">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
