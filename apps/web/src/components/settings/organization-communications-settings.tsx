'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  useUpdateWorkspaceCommunicationsSettings,
  useWorkspaceCommunicationsSettings,
} from '@/lib/hooks/use-chat';
import { MessageSquareText, Radio, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOGGLES = [
  { key: 'enabled', label: 'Enable module', description: 'Allow project channels and contextual discussions across the workspace.' },
  { key: 'voiceEnabled', label: 'Voice rooms', description: 'Allow self-hosted LiveKit audio rooms inside project conversations.' },
  { key: 'issueThreadsEnabled', label: 'Issue threads', description: 'Enable canonical discussion threads for issues.' },
  { key: 'documentThreadsEnabled', label: 'Doc threads', description: 'Enable discussion rooms linked to project docs.' },
  { key: 'attachmentsEnabled', label: 'Attachments', description: 'Allow file and image uploads in messages.' },
  { key: 'unreadTrackingEnabled', label: 'Unread tracking', description: 'Track room reads and unread counters across the workspace.' },
] as const;

export function OrganizationCommunicationsSettings({ organizationId }: { organizationId: string }) {
  const { data, isLoading, error } = useWorkspaceCommunicationsSettings(organizationId);
  const updateSettings = useUpdateWorkspaceCommunicationsSettings(organizationId);
  const { toast } = useToast();

  async function handleToggle(key: (typeof TOGGLES)[number]['key'], value: boolean) {
    try {
      await updateSettings.mutateAsync({ [key]: value });
      toast({
        title: 'Communications updated',
        description: 'Workspace chat and call settings were saved.',
      });
    } catch (mutationError) {
      toast({
        title: 'Failed to update communications',
        description: mutationError instanceof Error ? mutationError.message : 'Failed to update communications',
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading communications...</div>;
  }

  if (error || !data) {
    return (
      <div className="panel-danger animate-alert-in text-sm">
        {error instanceof Error ? error.message : 'Failed to load communications settings.'}
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-8 stagger">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <span className="kicker">Realtime</span>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <MessageSquareText className="h-4 w-4" />
              Communications
            </h2>
            <p className="text-sm text-muted-foreground max-w-prose">
              Control project chat, linked issue/doc threads, unread tracking, and voice rooms.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={data.settings.enabled ? 'chip-emerald' : 'chip'}>
              {data.settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <span className="chip">
              {data.serviceStatus.redisReady ? 'Redis fanout' : 'In-memory fallback'}
            </span>
          </div>
        </div>
        <div className="surface-card rounded-lg p-6 divide-y divide-border/60">
          {TOGGLES.map((toggle) => (
            <div
              key={toggle.key}
              className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start py-4 first:pt-0 last:pb-0"
            >
              <div className="space-y-1">
                <Label className="text-sm font-medium">{toggle.label}</Label>
                <p className="text-xs text-muted-foreground mt-1">{toggle.description}</p>
              </div>
              <div className="flex md:justify-end">
                <Switch
                  checked={Boolean(data.settings[toggle.key])}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => void handleToggle(toggle.key, checked)}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">Service status</span>
          <h2 className="text-lg font-semibold tracking-tight">Service readiness</h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Whether realtime and RTC services are accepting project traffic.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="surface-card rounded-lg p-5 space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-sm">
              {data.serviceStatus.redisReady ? (
                <Wifi className="h-4 w-4 text-accent-emerald" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              Redis
            </div>
            <p className="text-xs text-muted-foreground">
              {data.serviceStatus.redisReady
                ? 'Project rooms fan out over Redis-backed pub/sub.'
                : 'Redis is missing. Falling back to single-instance in-memory fanout.'}
            </p>
          </div>
          <div className="surface-card rounded-lg p-5 space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Radio
                className={cn(
                  'h-4 w-4',
                  data.serviceStatus.livekit.ready ? 'text-accent-emerald' : 'text-destructive'
                )}
              />
              LiveKit
            </div>
            <p className="text-xs text-muted-foreground">
              {data.serviceStatus.livekit.ready
                ? `Voice rooms connect through ${data.serviceStatus.livekit.url}.`
                : `Missing ${data.serviceStatus.livekit.missing.join(', ')}.`}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
