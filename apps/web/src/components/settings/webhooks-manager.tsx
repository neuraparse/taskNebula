'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
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
import { Plus, Trash2, Webhook as WebhookIcon, Pencil, Send } from 'lucide-react';

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

interface LastTestResult {
  success: boolean;
  statusCode: number | null;
  durationMs: number;
  error?: string;
}

export function WebhooksManager({ organizationId, projectId }: WebhooksManagerProps) {
  const t = useTranslations('settingsConfig');
  const formatter = useFormatter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [lastTestResults, setLastTestResults] = useState<Record<string, LastTestResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const queryKey = useMemo(
    () => ['webhooks', organizationId, projectId],
    [organizationId, projectId]
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ organizationId });
      if (projectId) params.append('projectId', projectId);
      const response = await fetch(`/api/webhooks?${params.toString()}`);
      const payload = await response.json().catch(() => ({ error: t('webhooks.fetch_failed') }));
      if (!response.ok) throw new Error(payload.error || t('webhooks.fetch_failed'));
      return payload as { webhooks: WebhookItem[] };
    },
    enabled: !!organizationId,
  });

  const deleteWebhook = useMutation({
    mutationFn: async (webhookId: string) => {
      const response = await fetch(`/api/webhooks/${webhookId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(t('webhooks.delete_failed'));
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
      if (!response.ok) throw new Error(t('webhooks.update_failed'));
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
        const errPayload = await response
          .json()
          .catch(() => ({ error: t('webhooks.save_failed') }));
        throw new Error(errPayload.error || t('webhooks.save_failed'));
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

  const sendTest = useMutation({
    mutationFn: async (webhookId: string) => {
      const response = await fetch(`/api/webhooks/${webhookId}/test`, {
        method: 'POST',
      });
      const payload = (await response
        .json()
        .catch(() => ({ error: t('webhooks.test_send_failed') }))) as {
        success?: boolean;
        statusCode?: number | null;
        responseSnippet?: string;
        durationMs?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || t('webhooks.test_send_failed'));
      }
      return { webhookId, payload };
    },
    onMutate: (webhookId) => {
      setTestingId(webhookId);
    },
    onSettled: () => {
      setTestingId(null);
    },
    onSuccess: ({ webhookId, payload }) => {
      const result: LastTestResult = {
        success: !!payload.success,
        statusCode: payload.statusCode ?? null,
        durationMs: payload.durationMs ?? 0,
        error: payload.error,
      };
      setLastTestResults((current) => ({ ...current, [webhookId]: result }));
      if (result.success) {
        toast({
          title: t('webhooks.test_delivered'),
          description: t('webhooks.test_http_result', {
            status: result.statusCode ?? '—',
            ms: result.durationMs,
          }),
        });
      } else {
        toast({
          title: t('webhooks.test_failed'),
          description: result.statusCode
            ? t('webhooks.test_http_result', { status: result.statusCode, ms: result.durationMs })
            : result.error || t('webhooks.test_no_response'),
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err, webhookId) => {
      setLastTestResults((current) => ({
        ...current,
        [webhookId]: {
          success: false,
          statusCode: null,
          durationMs: 0,
          error: err instanceof Error ? err.message : t('webhooks.test_send_failed'),
        },
      }));
      toast({
        title: t('webhooks.test_failed'),
        description: err instanceof Error ? err.message : t('webhooks.test_send_failed'),
        variant: 'destructive',
      });
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
        title: t('webhooks.missing_fields_title'),
        description: t('webhooks.missing_fields_desc'),
        variant: 'destructive',
      });
      return;
    }
    try {
      await saveWebhook.mutateAsync();
      toast({
        title: editingWebhook
          ? t('webhooks.updated_toast_title')
          : t('webhooks.created_toast_title'),
        description: editingWebhook
          ? t('webhooks.updated_toast_desc')
          : t('webhooks.created_toast_desc'),
      });
    } catch (err) {
      toast({
        title: t('webhooks.save_failed_title'),
        description: err instanceof Error ? err.message : t('webhooks.save_failed'),
        variant: 'destructive',
      });
    }
  }

  return (
    <section className="animate-fade-up space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <span className="kicker">{t('webhooks.kicker')}</span>
          <h2 className="text-lg font-semibold tracking-tight">
            {projectId ? t('webhooks.heading_project') : t('webhooks.heading_org')}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            {projectId ? t('webhooks.subtitle_project') : t('webhooks.subtitle_org')}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('webhooks.create_webhook')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[580px]">
            <DialogHeader>
              <DialogTitle>
                {editingWebhook ? t('webhooks.edit_webhook') : t('webhooks.create_webhook')}
              </DialogTitle>
              <DialogDescription>{t('webhooks.dialog_desc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('webhooks.name_label')}</Label>
                <Input
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={t('webhooks.name_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('webhooks.url_label')}</Label>
                <Input
                  value={formData.url}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, url: event.target.value }))
                  }
                  placeholder="https://example.com/webhooks/tasknebula"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('webhooks.events_label')}</Label>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {WEBHOOK_EVENTS.map((eventName) => (
                    <label
                      key={eventName}
                      className="border-border hover:bg-accent/40 flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors"
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
                {t('webhooks.cancel')}
              </Button>
              <Button onClick={() => void handleSave()} disabled={saveWebhook.isPending}>
                {saveWebhook.isPending
                  ? t('webhooks.saving')
                  : editingWebhook
                    ? t('webhooks.save_changes')
                    : t('webhooks.create_webhook')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t('webhooks.loading')}</p>
      ) : error ? (
        <div className="panel-warn text-sm">
          {error instanceof Error ? error.message : t('webhooks.load_error')}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <WebhookIcon className="text-muted-foreground/50 h-8 w-8" />
          <p className="text-muted-foreground text-sm">{t('webhooks.empty')}</p>
          <Button size="sm" onClick={openCreateDialog}>
            {t('webhooks.create_first')}
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
                    <span className="chip-emerald">{t('webhooks.status_active')}</span>
                  ) : (
                    <span className="chip">{t('webhooks.status_inactive')}</span>
                  )}
                </div>
                <code className="text-muted-foreground text-xs">{webhook.url}</code>
                <div className="flex flex-wrap gap-1">
                  {webhook.events.map((event) => (
                    <span key={event} className="chip font-mono text-[11px]">
                      {event}
                    </span>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  {t('webhooks.stats', { ok: webhook.successCount, failed: webhook.failureCount })}
                  {webhook.lastTriggeredAt ? (
                    <>
                      {' · '}
                      {t('webhooks.last_triggered', {
                        ago: formatter.relativeTime(new Date(webhook.lastTriggeredAt)),
                      })}
                    </>
                  ) : null}
                </p>
                {lastTestResults[webhook.id] ? (
                  <p
                    className={`text-xs ${
                      lastTestResults[webhook.id]!.success ? 'text-emerald-500' : 'text-destructive'
                    }`}
                  >
                    {t('webhooks.last_test_label')}{' '}
                    {lastTestResults[webhook.id]!.statusCode
                      ? `${lastTestResults[webhook.id]!.statusCode} ${
                          lastTestResults[webhook.id]!.success
                            ? t('webhooks.ok')
                            : t('webhooks.err')
                        }`
                      : lastTestResults[webhook.id]!.error || t('webhooks.failed')}
                    {' · '}
                    {lastTestResults[webhook.id]!.durationMs}
                    {'ms'}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-8 text-xs"
                  onClick={() => sendTest.mutate(webhook.id)}
                  disabled={testingId === webhook.id}
                  aria-label={t('webhooks.send_test_aria')}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {testingId === webhook.id ? t('webhooks.sending') : t('webhooks.send_test')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground h-8 w-8"
                  onClick={() => openEditDialog(webhook)}
                  aria-label={t('webhooks.edit_aria')}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-8 text-xs"
                  onClick={() =>
                    toggleWebhook.mutate({ webhookId: webhook.id, isActive: !webhook.isActive })
                  }
                  disabled={toggleWebhook.isPending}
                >
                  {webhook.isActive ? t('webhooks.disable') : t('webhooks.enable')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => {
                    if (window.confirm(t('webhooks.delete_confirm'))) {
                      deleteWebhook.mutate(webhook.id);
                    }
                  }}
                  disabled={deleteWebhook.isPending}
                  aria-label={t('webhooks.delete_aria')}
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
