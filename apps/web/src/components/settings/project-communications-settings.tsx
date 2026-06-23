'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import {
  useProjectCommunicationsSettings,
  useUpdateProjectCommunicationsSettings,
} from '@/lib/hooks/use-chat';
import { MessageSquareText } from 'lucide-react';

const TOGGLES = [
  {
    key: 'enabled',
    labelKey: 'projectComms.toggle_enabled_label',
    descKey: 'projectComms.toggle_enabled_desc',
  },
  {
    key: 'inheritWorkspaceDefaults',
    labelKey: 'projectComms.toggle_inherit_label',
    descKey: 'projectComms.toggle_inherit_desc',
  },
  {
    key: 'voiceEnabled',
    labelKey: 'projectComms.toggle_voice_label',
    descKey: 'projectComms.toggle_voice_desc',
  },
  {
    key: 'issueThreadsEnabled',
    labelKey: 'projectComms.toggle_issue_threads_label',
    descKey: 'projectComms.toggle_issue_threads_desc',
  },
  {
    key: 'documentThreadsEnabled',
    labelKey: 'projectComms.toggle_doc_threads_label',
    descKey: 'projectComms.toggle_doc_threads_desc',
  },
  {
    key: 'attachmentsEnabled',
    labelKey: 'projectComms.toggle_attachments_label',
    descKey: 'projectComms.toggle_attachments_desc',
  },
  {
    key: 'unreadTrackingEnabled',
    labelKey: 'projectComms.toggle_unread_label',
    descKey: 'projectComms.toggle_unread_desc',
  },
] as const;

export function ProjectCommunicationsSettings({ projectId }: { projectId: string }) {
  const t = useTranslations('settingsConfig');
  const { data, isLoading, error } = useProjectCommunicationsSettings(projectId);
  const updateSettings = useUpdateProjectCommunicationsSettings(projectId);
  const { toast } = useToast();

  async function handleToggle(key: (typeof TOGGLES)[number]['key'], value: boolean) {
    try {
      await updateSettings.mutateAsync({ [key]: value });
      toast({
        title: t('projectComms.updated_toast_title'),
        description: t('projectComms.updated_toast_desc'),
      });
    } catch {
      toast({
        title: t('projectComms.update_failed_title'),
        description: t('projectComms.update_failed_title'),
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground p-4 text-sm">{t('projectComms.loading')}</div>;
  }

  if (error || !data) {
    return (
      <div className="panel-danger animate-alert-in text-sm">{t('projectComms.load_error')}</div>
    );
  }

  return (
    <div className="animate-fade-up stagger space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <span className="kicker">{t('projectComms.realtime_kicker')}</span>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <MessageSquareText className="h-4 w-4" />
              {t('projectComms.heading')}
            </h2>
            <p className="text-muted-foreground max-w-prose text-sm">
              {t('projectComms.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={data.effectiveSettings.enabled ? 'chip-emerald' : 'chip'}>
              {data.effectiveSettings.enabled ? t('projectComms.live') : t('projectComms.disabled')}
            </span>
            <span className="chip">{data.project.key}</span>
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
          <span className="kicker">{t('projectComms.runtime_kicker')}</span>
          <h2 className="text-lg font-semibold tracking-tight">
            {t('projectComms.effective_policy')}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t('projectComms.effective_policy_desc')}
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(data.effectiveSettings).map(([key, value]) => (
            <div key={key} className="surface-card rounded-lg px-4 py-3">
              <div className="text-muted-foreground text-xs uppercase tracking-[0.14em]">{key}</div>
              <div className="mt-1 text-sm font-medium">{String(value)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
