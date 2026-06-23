'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import {
  useUpdateWorkspaceCommunicationsSettings,
  useWorkspaceCommunicationsSettings,
} from '@/lib/hooks/use-chat';
import { MessageSquareText, Radio, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOGGLES = [
  {
    key: 'enabled',
    labelKey: 'orgComms.toggle_enabled_label',
    descKey: 'orgComms.toggle_enabled_desc',
  },
  {
    key: 'voiceEnabled',
    labelKey: 'orgComms.toggle_voice_label',
    descKey: 'orgComms.toggle_voice_desc',
  },
  {
    key: 'issueThreadsEnabled',
    labelKey: 'orgComms.toggle_issue_threads_label',
    descKey: 'orgComms.toggle_issue_threads_desc',
  },
  {
    key: 'documentThreadsEnabled',
    labelKey: 'orgComms.toggle_doc_threads_label',
    descKey: 'orgComms.toggle_doc_threads_desc',
  },
  {
    key: 'attachmentsEnabled',
    labelKey: 'orgComms.toggle_attachments_label',
    descKey: 'orgComms.toggle_attachments_desc',
  },
  {
    key: 'unreadTrackingEnabled',
    labelKey: 'orgComms.toggle_unread_label',
    descKey: 'orgComms.toggle_unread_desc',
  },
] as const;

export function OrganizationCommunicationsSettings({ organizationId }: { organizationId: string }) {
  const t = useTranslations('settingsConfig');
  const { data, isLoading, error } = useWorkspaceCommunicationsSettings(organizationId);
  const updateSettings = useUpdateWorkspaceCommunicationsSettings(organizationId);
  const { toast } = useToast();

  async function handleToggle(key: (typeof TOGGLES)[number]['key'], value: boolean) {
    try {
      await updateSettings.mutateAsync({ [key]: value });
      toast({
        title: t('orgComms.updated_toast_title'),
        description: t('orgComms.updated_toast_desc'),
      });
    } catch {
      toast({
        title: t('orgComms.update_failed_title'),
        description: t('orgComms.update_failed_title'),
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground p-4 text-sm">{t('orgComms.loading')}</div>;
  }

  if (error || !data) {
    return <div className="panel-danger animate-alert-in text-sm">{t('orgComms.load_error')}</div>;
  }

  return (
    <div className="animate-fade-up stagger space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <span className="kicker">{t('orgComms.realtime_kicker')}</span>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <MessageSquareText className="h-4 w-4" />
              {t('orgComms.heading')}
            </h2>
            <p className="text-muted-foreground max-w-prose text-sm">{t('orgComms.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={data.settings.enabled ? 'chip-emerald' : 'chip'}>
              {data.settings.enabled ? t('orgComms.enabled') : t('orgComms.disabled')}
            </span>
            <span className="chip">
              {data.serviceStatus.redisReady
                ? t('orgComms.redis_fanout')
                : t('orgComms.inmemory_fallback')}
            </span>
          </div>
        </div>
        <div className="surface-card divide-border/60 divide-y rounded-lg p-6">
          {TOGGLES.map((toggle) => (
            <div
              key={toggle.key}
              className="grid grid-cols-1 items-start gap-4 py-4 first:pt-0 last:pb-0 md:grid-cols-[240px_1fr]"
            >
              <div className="space-y-1">
                <Label className="text-sm font-medium">{t(toggle.labelKey)}</Label>
                <p className="text-muted-foreground mt-1 text-xs">{t(toggle.descKey)}</p>
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
          <span className="kicker">{t('orgComms.service_status_kicker')}</span>
          <h2 className="text-lg font-semibold tracking-tight">
            {t('orgComms.service_readiness')}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t('orgComms.service_readiness_desc')}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="surface-card space-y-1.5 rounded-lg p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              {data.serviceStatus.redisReady ? (
                <Wifi className="text-accent-emerald h-4 w-4" />
              ) : (
                <WifiOff className="text-muted-foreground h-4 w-4" />
              )}
              Redis
            </div>
            <p className="text-muted-foreground text-xs">
              {data.serviceStatus.redisReady
                ? t('orgComms.redis_ready_desc')
                : t('orgComms.redis_missing_desc')}
            </p>
          </div>
          <div className="surface-card space-y-1.5 rounded-lg p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Radio
                className={cn(
                  'h-4 w-4',
                  data.serviceStatus.livekit.ready ? 'text-accent-emerald' : 'text-destructive'
                )}
              />
              LiveKit
            </div>
            <p className="text-muted-foreground text-xs">
              {data.serviceStatus.livekit.ready
                ? t('orgComms.livekit_ready_desc', { url: data.serviceStatus.livekit.url ?? '' })
                : t('orgComms.livekit_missing_desc', {
                    missing: data.serviceStatus.livekit.missing.join(', '),
                  })}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
