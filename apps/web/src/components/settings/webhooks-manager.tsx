'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Webhook as WebhookIcon, Pencil } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface WebhooksManagerProps {
  organizationId: string;
  projectId?: string;
}

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  successCount: number;
  failureCount: number;
}

const WEBHOOK_EVENTS = [
  'issue.created',
  'issue.updated',
  'issue.deleted',
  'issue.status_changed',
  'issue.assigned',
  'issue.commented',
  'sprint.started',
  'sprint.completed',
  'project.created',
  'project.updated',
];

const EMPTY_FORM = {
  name: '',
  url: '',
  events: ['issue.created', 'issue.updated'],
};

export function WebhooksManager({ organizationId, projectId }: WebhooksManagerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const queryKey = useMemo(() => ['webhooks', organizationId, projectId], [organizationId, projectId]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ organizationId });
      if (projectId) params.append('projectId', projectId);
      const response = await fetch(`/api/webhooks?${params.toString()}`);
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch webhooks' }));
      if (!response.ok) throw new Error(payload.error || 'Failed to fetch webhooks');
      return payload as { webhooks: WebhookItem[] };
    },
    enabled: !!organizationId,
  });

  const deleteWebhook = useMutation({
    mutationFn: async (webhookId: string) => {
      const response = await fetch(`/api/webhooks/${webhookId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete webhook');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const toggleWebhook = useMutation({
    mutationFn: async ({ webhookId, isActive }: { webhookId: string; isActive: boolean }) => {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error('Failed to update webhook');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveWebhook = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name.trim(),
        url: formData.url.trim(),
        organizationId,
        projectId,
        events: formData.events,
      };
      const response = await fetch(
        editingWebhook ? `/api/webhooks/${editingWebhook.id}` : '/api/webhooks',
        {
          method: editingWebhook ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({ error: 'Failed to save webhook' }));
        throw new Error(errPayload.error || 'Failed to save webhook');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDialogOpen(false);
      setEditingWebhook(null);
      setFormData(EMPTY_FORM);
    },
  });

  const webhooks = data?.webhooks || [];

  function openCreateDialog() {
    setEditingWebhook(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(webhook: WebhookItem) {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: Array.isArray(webhook.events) ? webhook.events : [],
    });
    setDialogOpen(true);
  }

  function toggleEvent(eventName: string, checked: boolean) {
    setFormData((current) => ({
      ...current,
      events: checked
        ? [...current.events, eventName]
        : current.events.filter((e) => e !== eventName),
    }));
  }

  async function handleSave() {
    if (!formData.name.trim() || !formData.url.trim() || formData.events.length === 0) {
      toast({
        title: 'Missing fields',
        description: 'Name, URL, and at least one event are required.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await saveWebhook.mutateAsync();
      toast({
        title: editingWebhook ? 'Webhook updated' : 'Webhook created',
        description: editingWebhook
          ? 'Webhook settings were saved successfully.'
          : 'Webhook created successfully.',
      });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Failed to save webhook',
        variant: 'destructive',
      });
    }
  }

  return (
    <section className="animate-fade-up space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <span className="kicker">Integrations</span>
          <h2 className="text-lg font-semibold tracking-tight">
            {projectId ? 'Project webhooks' : 'Webhooks'}
          </h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            {projectId
              ? 'Send project-specific events to external services.'
              : 'Manage organization-wide webhook integrations.'}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[580px]">
            <DialogHeader>
              <DialogTitle>{editingWebhook ? 'Edit webhook' : 'Create webhook'}</DialogTitle>
              <DialogDescription>
                Choose the events to deliver and the destination URL that should receive them.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="GitHub sync"
                />
              </div>
              <div className="space-y-2">
                <Label>Destination URL</Label>
                <Input
                  value={formData.url}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, url: event.target.value }))
                  }
                  placeholder="https://example.com/webhooks/tasknebula"
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {WEBHOOK_EVENTS.map((eventName) => (
                    <label
                      key={eventName}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={formData.events.includes(eventName)}
                        onCheckedChange={(checked) => toggleEvent(eventName, checked === true)}
                      />
                      <span className="font-mono text-xs">{eventName}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} disabled={saveWebhook.isPending}>
                {saveWebhook.isPending
                  ? 'Saving...'
                  : editingWebhook
                    ? 'Save changes'
                    : 'Create webhook'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
      ) : error ? (
        <div className="panel-warn text-sm">
          {error instanceof Error ? error.message : 'Webhooks could not be loaded.'}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <WebhookIcon className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No webhooks yet.</p>
          <Button size="sm" onClick={openCreateDialog}>
            Create your first webhook
          </Button>
        </div>
      ) : (
        <div className="surface-card rounded-lg p-2">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="row-interactive flex min-h-[44px] items-start justify-between gap-4 rounded-md px-3 py-3"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{webhook.name}</span>
                  {webhook.isActive ? (
                    <span className="chip-emerald">Active</span>
                  ) : (
                    <span className="chip">Inactive</span>
                  )}
                </div>
                <code className="text-xs text-muted-foreground">{webhook.url}</code>
                <div className="flex flex-wrap gap-1">
                  {webhook.events.map((event) => (
                    <span key={event} className="chip font-mono text-[11px]">
                      {event}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {webhook.successCount} ok · {webhook.failureCount} failed
                  {webhook.lastTriggeredAt ? (
                    <>
                      {' '}
                      · Last triggered{' '}
                      {formatDistanceToNow(new Date(webhook.lastTriggeredAt), { addSuffix: true })}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => openEditDialog(webhook)}
                  aria-label="Edit webhook"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() =>
                    toggleWebhook.mutate({ webhookId: webhook.id, isActive: !webhook.isActive })
                  }
                  disabled={toggleWebhook.isPending}
                >
                  {webhook.isActive ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (window.confirm('Delete this webhook?')) {
                      deleteWebhook.mutate(webhook.id);
                    }
                  }}
                  disabled={deleteWebhook.isPending}
                  aria-label="Delete webhook"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
