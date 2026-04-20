'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MessageSquare, CheckCircle2, UserPlus, Link2, Rocket, Trophy, Activity, Plus, Edit, Trash } from 'lucide-react';
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

export function ActivityFeed({ organizationId, limit = 20 }: ActivityFeedProps) {
  const { data, isLoading } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ['recent-activities', organizationId, limit],
    queryFn: async () => {
      const response = await fetch(`/api/activities/recent?organizationId=${organizationId}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const activities = data?.activities || [];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'status_change':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'assigned':
        return <UserPlus className="h-4 w-4 text-purple-500" />;
      case 'linked':
        return <Link2 className="h-4 w-4 text-orange-500" />;
      case 'sprint_started':
        return <Rocket className="h-4 w-4 text-indigo-500" />;
      case 'sprint_completed':
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'created':
        return <Plus className="h-4 w-4 text-emerald-500" />;
      case 'updated':
        return <Edit className="h-4 w-4 text-amber-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="border-muted-foreground/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-muted-foreground/10">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Recent Activity</CardTitle>
          <Badge variant="secondary">{activities.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <Avatar className="h-8 w-8 ring-1 ring-border">
                  <AvatarImage src={activity.user.image || undefined} />
                  <AvatarFallback className="text-xs font-semibold">
                    {activity.user.name?.[0]?.toUpperCase() || activity.user.email[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-start gap-2">
                    {getActivityIcon(activity.type)}
                    <span className="text-sm flex-1">
                      <span className="font-medium">{activity.user.name || activity.user.email.split('@')[0]}</span>{' '}
                      <span className="text-muted-foreground">{activity.message}</span>
                    </span>
                  </div>

                  {activity.issue && (
                    <div className="flex items-center gap-2 ml-6">
                      <Badge variant="outline" className="font-mono text-xs">
                        {activity.issue.key}
                      </Badge>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {activity.issue.title}
                      </span>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground ml-6">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
