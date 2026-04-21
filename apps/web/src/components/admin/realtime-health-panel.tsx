'use client';

import { useRealtimeHealth } from '@/lib/hooks/use-chat';
import { cn } from '@/lib/utils';
import { Activity, MessagesSquare, Radio, Users, Wifi } from 'lucide-react';
import type { ComponentType } from 'react';

type ServiceTone = 'live' | 'warn' | 'danger';

export function RealtimeHealthPanel() {
  const { data, isLoading, error } = useRealtimeHealth();

  if (isLoading) {
    return (
      <div className="surface-card p-6 text-sm text-muted-foreground">Loading realtime health...</div>
    );
  }

  if (error || !data) {
    return (
      <div className="surface-card p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load realtime health.'}
      </div>
    );
  }

  const services: Array<{
    name: string;
    tone: ServiceTone;
    metric: string;
    detail: string;
  }> = [
    {
      name: 'Redis fanout',
      tone: data.services.redis.ready ? 'live' : 'warn',
      metric: data.services.redis.ready ? 'Ready' : 'Fallback',
      detail: data.services.redis.ready
        ? 'SSE events and presence fan out through Redis pub/sub.'
        : 'Redis missing. Using single-instance in-memory fallback.',
    },
    {
      name: 'LiveKit',
      tone: data.services.livekit.ready ? 'live' : 'danger',
      metric: data.services.livekit.ready ? 'Ready' : 'Blocked',
      detail: data.services.livekit.ready
        ? `Configured for ${data.services.livekit.url}.`
        : `Missing: ${data.services.livekit.missing.join(', ')}.`,
    },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      {/* KPI tiles */}
      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthTile label="Channels" value={data.stats.channels} icon={MessagesSquare} tone="blue" />
        <HealthTile label="Rooms" value={data.stats.rooms} icon={Users} tone="violet" />
        <HealthTile label="Active calls" value={data.stats.activeCalls} icon={Radio} tone="emerald" live />
        <HealthTile label="Read states" value={data.stats.readStates} icon={Activity} tone="cyan" />
      </div>

      {/* Service status grid */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Services</h3>
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {services.map((service) => (
            <ServiceCard key={service.name} {...service} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HealthTile({
  label,
  value,
  icon: Icon,
  live,
  tone = 'blue',
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  live?: boolean;
  tone?: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';
}) {
  return (
    <div className="surface-card flex max-h-[140px] flex-col justify-between gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="kicker truncate">{label}</p>
        <span className={cn('icon-tile', `icon-tile-accent-${tone}`)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {live && value > 0 ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="realtime-ping">
              <span className="status-dot status-live" />
            </span>
            Live
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ServiceCard({
  name,
  tone,
  metric,
  detail,
}: {
  name: string;
  tone: ServiceTone;
  metric: string;
  detail: string;
}) {
  const dotClass =
    tone === 'live' ? 'status-live' : tone === 'warn' ? 'status-warn' : 'status-danger';
  const textClass =
    tone === 'live'
      ? 'text-accent-emerald'
      : tone === 'warn'
        ? 'text-accent-amber'
        : 'text-accent-rose';
  const containerClass = tone === 'danger' ? 'panel-danger p-4 space-y-2' : 'surface-card p-4 space-y-2';
  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {tone === 'danger' ? (
            <span className="realtime-ping shrink-0">
              <span className={cn('status-dot', dotClass)} />
            </span>
          ) : (
            <span className={cn('status-dot shrink-0', dotClass, tone === 'live' && 'animate-dot-breathe')} />
          )}
          <span className="text-sm font-medium truncate">{name}</span>
        </div>
        <span className={cn('text-xs font-medium', textClass)}>{metric}</span>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Wifi className="h-3 w-3 shrink-0" />
        <span className="truncate">{detail}</span>
      </p>
    </div>
  );
}
