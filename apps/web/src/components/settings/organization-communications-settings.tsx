'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useUpdateWorkspaceCommunicationsSettings,
  useWorkspaceCommunicationsSettings,
} from '@/lib/hooks/use-chat';
import { Radio, Wifi, WifiOff } from 'lucide-react';

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
    return <div className="p-4 text-sm text-muted-foreground">Loading communications…</div>;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load communications settings.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Communications</CardTitle>
              <CardDescription>
                Control project chat, linked issue/doc threads, unread tracking, and self-hosted voice rooms.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={data.settings.enabled ? 'default' : 'secondary'}>
                {data.settings.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Badge variant={data.serviceStatus.redisReady ? 'outline' : 'secondary'}>
                {data.serviceStatus.redisReady ? 'Redis fanout' : 'In-memory fallback'}
              </Badge>
              <Badge variant={data.serviceStatus.livekit.ready ? 'outline' : 'destructive'}>
                {data.serviceStatus.livekit.ready ? 'LiveKit ready' : 'LiveKit blocked'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {TOGGLES.map((toggle) => (
            <div key={toggle.key} className="flex items-start justify-between gap-6 rounded-lg border border-border/60 p-4">
              <div className="space-y-1">
                <div className="font-medium">{toggle.label}</div>
                <p className="text-sm text-muted-foreground">{toggle.description}</p>
              </div>
              <Switch
                checked={Boolean(data.settings[toggle.key])}
                disabled={updateSettings.isPending}
                onCheckedChange={(checked) => void handleToggle(toggle.key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Service readiness</CardTitle>
          <CardDescription>
            Deployment secrets stay at the infra layer. This panel shows whether realtime and RTC are ready to accept project traffic.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border/60 p-4">
            <div className="mb-2 flex items-center gap-2 font-medium">
              {data.serviceStatus.redisReady ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              Redis
            </div>
            <p className="text-sm text-muted-foreground">
              {data.serviceStatus.redisReady
                ? 'Project rooms will fan out over Redis-backed pub/sub.'
                : 'Redis is missing. The app will fall back to single-instance in-memory fanout.'}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <Radio className="h-4 w-4" />
              LiveKit
            </div>
            <p className="text-sm text-muted-foreground">
              {data.serviceStatus.livekit.ready
                ? `Voice rooms can connect through ${data.serviceStatus.livekit.url}. LiveKit handles the RTC runtime; optional TURN relays stay at deploy time.`
                : `Missing ${data.serviceStatus.livekit.missing.join(', ')}.`}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
