'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface WebhooksManagerProps {
  organizationId: string;
  projectId?: string;
}

export function WebhooksManager({ organizationId, projectId }: WebhooksManagerProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks', organizationId, projectId],
    queryFn: async () => {
      const params = new URLSearchParams({ organizationId });
      if (projectId) params.append('projectId', projectId);

      const response = await fetch(`/api/webhooks?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch webhooks');
      return response.json();
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
      queryClient.invalidateQueries({ queryKey: ['webhooks', organizationId, projectId] });
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
      queryClient.invalidateQueries({ queryKey: ['webhooks', organizationId, projectId] });
    },
  });

  const webhooks = data?.webhooks || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Manage webhooks for external integrations</CardDescription>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Webhook
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <WebhookIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No webhooks yet.</p>
            <p className="text-sm">Create your first webhook to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook: any) => (
              <div key={webhook.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{webhook.name}</span>
                    {webhook.isActive ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    <code className="bg-muted px-2 py-1 rounded text-xs">{webhook.url}</code>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {webhook.events.length} events · {webhook.successCount} successful ·{' '}
                    {webhook.failureCount} failed
                    {webhook.lastTriggeredAt && (
                      <> · Last triggered{' '}
                        {formatDistanceToNow(new Date(webhook.lastTriggeredAt), { addSuffix: true })}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
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
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this webhook?')) {
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

