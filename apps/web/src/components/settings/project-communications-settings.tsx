'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  useProjectCommunicationsSettings,
  useUpdateProjectCommunicationsSettings,
} from '@/lib/hooks/use-chat';
import { MessageSquareText } from 'lucide-react';

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
    return <div className="p-4 text-sm text-muted-foreground">Loading chat and call settings...</div>;
  }

  if (error || !data) {
    return (
      <div className="panel-danger animate-alert-in text-sm">
        {error instanceof Error ? error.message : 'Failed to load project communications.'}
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
              Chat & calls
            </h2>
            <p className="text-sm text-muted-foreground max-w-prose">
              Shape how channels, issue discussions, doc threads, unread tracking, and voice rooms
              behave in this project.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={data.effectiveSettings.enabled ? 'chip-emerald' : 'chip'}>
              {data.effectiveSettings.enabled ? 'Live' : 'Disabled'}
            </span>
            <span className="chip">{data.project.key}</span>
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
                  checked={Boolean(data.projectSettings[toggle.key])}
                  disabled={!data.access.canManage || updateSettings.isPending}
                  onCheckedChange={(checked) => void handleToggle(toggle.key, checked)}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">Runtime</span>
          <h2 className="text-lg font-semibold tracking-tight">Effective policy</h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Workspace and project rules combine into the runtime policy below. Workspace-level
            disables still win.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(data.effectiveSettings).map(([key, value]) => (
            <div key={key} className="surface-card rounded-lg px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{key}</div>
              <div className="mt-1 text-sm font-medium">{String(value)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
