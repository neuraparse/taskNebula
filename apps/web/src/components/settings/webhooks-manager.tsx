'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

      const response = await fetch(editingWebhook ? `/api/webhooks/${editingWebhook.id}` : '/api/webhooks', {
        method: editingWebhook ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to save webhook' }));
        throw new Error(error.error || 'Failed to save webhook');
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
        : current.events.filter((event) => event !== eventName),
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
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save webhook',
        variant: 'destructive',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>{projectId ? 'Project webhooks' : 'Organization webhooks'}</CardTitle>
            <CardDescription>
              {projectId
                ? 'Send project-specific events to external services.'
                : 'Manage organization-wide webhook integrations.'}
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
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
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                    placeholder="GitHub sync"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Destination URL</Label>
                  <Input
                    value={formData.url}
                    onChange={(event) => setFormData((current) => ({ ...current, url: event.target.value }))}
                    placeholder="https://example.com/webhooks/tasknebula"
                  />
                </div>
                <div className="space-y-3">
                  <Label>Events</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {WEBHOOK_EVENTS.map((eventName) => (
                      <label key={eventName} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                        <Checkbox
                          checked={formData.events.includes(eventName)}
                          onCheckedChange={(checked) => toggleEvent(eventName, checked === true)}
                        />
                        <span>{eventName}</span>
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
                  {saveWebhook.isPending ? 'Saving...' : editingWebhook ? 'Save changes' : 'Create webhook'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : error ? (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-6 text-sm text-yellow-700 dark:text-yellow-200">
              {error instanceof Error ? error.message : 'Webhooks could not be loaded.'}
            </div>
          ) : webhooks.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <WebhookIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No webhooks yet.</p>
            <p className="text-sm">Create the first webhook to send TaskNebula events to your tools.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{webhook.name}</span>
                    {webhook.isActive ? <Badge variant="default">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <code className="rounded bg-muted px-2 py-1 text-xs">{webhook.url}</code>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="outline">
                        {event}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {webhook.successCount} successful · {webhook.failureCount} failed
                    {webhook.lastTriggeredAt ? (
                      <>
                        {' '}
                        · Last triggered{' '}
                        {formatDistanceToNow(new Date(webhook.lastTriggeredAt), { addSuffix: true })}
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(webhook)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleWebhook.mutate({ webhookId: webhook.id, isActive: !webhook.isActive })}
                    disabled={toggleWebhook.isPending}
                  >
                    {webhook.isActive ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (window.confirm('Delete this webhook?')) {
                        deleteWebhook.mutate(webhook.id);
                      }
                    }}
                    disabled={deleteWebhook.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
