'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRealtimeHealth } from '@/lib/hooks/use-chat';
import { Activity, Radio, Wifi } from 'lucide-react';

export function RealtimeHealthPanel() {
  const { data, isLoading, error } = useRealtimeHealth();

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading realtime health…</div>;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load realtime health.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Realtime / RTC health</CardTitle>
          <CardDescription>
            Read-only control plane visibility for Redis fanout, LiveKit readiness, and current collaboration load.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Channels" value={data.stats.channels} icon={Activity} />
          <StatCard label="Rooms" value={data.stats.rooms} icon={Activity} />
          <StatCard label="Active calls" value={data.stats.activeCalls} icon={Radio} />
          <StatCard label="Read states" value={data.stats.readStates} icon={Wifi} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Redis fanout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={data.services.redis.ready ? 'default' : 'secondary'}>
              {data.services.redis.ready ? 'Ready' : 'Fallback'}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {data.services.redis.ready
                ? 'SSE events and room presence can fan out across instances through Redis pub/sub.'
                : 'Redis is missing. The app is using a single-instance in-memory fallback.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">LiveKit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={data.services.livekit.ready ? 'default' : 'destructive'}>
              {data.services.livekit.ready ? 'Ready' : 'Blocked'}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {data.services.livekit.ready
                ? `RTC traffic is configured for ${data.services.livekit.url}. Optional TURN relays stay outside the app control plane.`
                : `Missing ${data.services.livekit.missing.join(', ')}.`}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
        </div>
        <div className="rounded-md border p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
