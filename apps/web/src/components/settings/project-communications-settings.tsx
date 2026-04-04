'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useProjectCommunicationsSettings,
  useUpdateProjectCommunicationsSettings,
} from '@/lib/hooks/use-chat';

const TOGGLES = [
  { key: 'enabled', label: 'Enable project chat', description: 'Allow channels and contextual discussions in this project.' },
  { key: 'inheritWorkspaceDefaults', label: 'Inherit workspace defaults', description: 'Keep project rules gated by workspace-wide communications policy.' },
  { key: 'voiceEnabled', label: 'Voice rooms', description: 'Allow LiveKit audio rooms in project conversations.' },
  { key: 'issueThreadsEnabled', label: 'Issue threads', description: 'Show and maintain canonical issue discussions.' },
  { key: 'documentThreadsEnabled', label: 'Doc threads', description: 'Allow docs pages to share a linked discussion room.' },
  { key: 'attachmentsEnabled', label: 'Attachments', description: 'Allow files and pasted images in project conversations.' },
  { key: 'unreadTrackingEnabled', label: 'Unread tracking', description: 'Track read state and unread counters for channels and linked rooms.' },
] as const;

export function ProjectCommunicationsSettings({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useProjectCommunicationsSettings(projectId);
  const updateSettings = useUpdateProjectCommunicationsSettings(projectId);
  const { toast } = useToast();

  async function handleToggle(key: (typeof TOGGLES)[number]['key'], value: boolean) {
    try {
      await updateSettings.mutateAsync({ [key]: value });
      toast({
        title: 'Project communications updated',
        description: 'Chat and call rules were saved for this project.',
      });
    } catch (mutationError) {
      toast({
        title: 'Failed to update project communications',
        description: mutationError instanceof Error ? mutationError.message : 'Failed to update project communications',
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading chat and call settings…</div>;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load project communications.'}
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
              <CardTitle>Chat & Calls</CardTitle>
              <CardDescription>
                Shape how channels, issue discussions, doc threads, unread tracking, and voice rooms behave in this project.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={data.effectiveSettings.enabled ? 'default' : 'secondary'}>
                {data.effectiveSettings.enabled ? 'Live' : 'Disabled'}
              </Badge>
              <Badge variant="outline">{data.project.key}</Badge>
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
                checked={Boolean(data.projectSettings[toggle.key])}
                disabled={!data.access.canManage || updateSettings.isPending}
                onCheckedChange={(checked) => void handleToggle(toggle.key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Effective runtime</CardTitle>
          <CardDescription>
            Workspace and project rules combine into the runtime policy below. Workspace-level disables still win.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(data.effectiveSettings).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border/60 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{key}</div>
              <div className="mt-2 text-sm font-medium">{String(value)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
