'use client';

import { useRealtimeHealth } from '@/lib/hooks/use-chat';
import { Activity, Radio, Wifi } from 'lucide-react';

export function RealtimeHealthPanel() {
  const { data, isLoading, error } = useRealtimeHealth();

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading realtime health...</div>;
  }

  if (error || !data) {
    return (
      <div className="surface-card p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load realtime health.'}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="surface-card p-6 space-y-4">
        <div className="space-y-1">
          <span className="kicker">Admin</span>
          <h2 className="text-lg font-semibold">Realtime health</h2>
          <p className="text-sm text-muted-foreground">
            Redis fanout, LiveKit readiness, and current collaboration load.
          </p>
        </div>

        {/* Stat tiles */}
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HealthTile label="Channels" value={data.stats.channels} icon={Activity} />
          <HealthTile label="Rooms" value={data.stats.rooms} icon={Activity} />
          <HealthTile label="Active calls" value={data.stats.activeCalls} icon={Radio} />
          <HealthTile label="Read states" value={data.stats.readStates} icon={Wifi} />
        </div>

        {/* Service status */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Redis fanout</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`status-dot ${data.services.redis.ready ? 'status-live' : 'status-warn'}`}
                />
                <span className="text-xs text-muted-foreground">
                  {data.services.redis.ready ? 'Ready' : 'Fallback'}
                </span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {data.services.redis.ready
                ? 'SSE events and room presence fan out through Redis pub/sub.'
                : 'Redis is missing. Using single-instance in-memory fallback.'}
            </p>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">LiveKit</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`status-dot ${data.services.livekit.ready ? 'status-live' : 'status-danger'}`}
                />
                <span className="text-xs text-muted-foreground">
                  {data.services.livekit.ready ? 'Ready' : 'Blocked'}
                </span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {data.services.livekit.ready
                ? `Configured for ${data.services.livekit.url}.`
                : `Missing: ${data.services.livekit.missing.join(', ')}.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
}) {
  return (
    <div className="surface-card flex items-center justify-between p-4">
      <div>
        <p className="kicker">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </div>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
