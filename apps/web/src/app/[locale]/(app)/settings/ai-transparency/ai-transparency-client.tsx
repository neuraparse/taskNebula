'use client';

/**
 * /settings/ai-transparency — workspace-scoped AI Transparency dashboard.
 *
 * Required by EU AI Act Article 50 (2026-08-02). Lists every AI feature
 * currently exposed in the workspace and shows:
 *   - feature name + summary
 *   - model and provider
 *   - what data is sent on every call
 *   - retention policy
 *   - per-feature enable/disable switch
 *   - workspace-wide human-oversight toggle (auto vs review_required)
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExternalLink, ShieldCheck, Sparkles, Database, Clock3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  useOrganizationAgentSettings,
  useUpdateOrganizationAgentSettings,
} from '@/lib/hooks/use-agents';
import {
  AI_FEATURE_MODEL_CARDS,
  USER_FACING_AI_FEATURES,
  type AiFeatureId,
} from '@/config/ai-model-cards';
import type { AgentCapabilityKey, AiOversightMode } from '@/lib/agents/config';

const FEATURE_SETTING_MAP: Partial<
  Record<AiFeatureId, { type: 'assistant' } | { type: 'capability'; key: AgentCapabilityKey }>
> = {
  draft: { type: 'assistant' },
  assist: { type: 'assistant' },
  ask: { type: 'assistant' },
  summary: { type: 'assistant' },
  triage: { type: 'capability', key: 'backlog_triage' },
};

export function AiTransparencyClient({ organizationId }: { organizationId: string }) {
  const t = useTranslations('pagesSettings');
  const tConfig = useTranslations('settingsConfig');
  const { toast } = useToast();
  const { data, isLoading, error } = useOrganizationAgentSettings(organizationId);
  const updateSettings = useUpdateOrganizationAgentSettings(organizationId);
  const workspaceSettings = data?.workspaceSettings;
  const canManage = data?.access.canManage ?? false;
  const oversight = workspaceSettings?.aiOversight ?? 'review_required';

  async function persistOversight(next: AiOversightMode) {
    try {
      await updateSettings.mutateAsync({ aiOversight: next });
      toast({
        title: tConfig('orgAi.saved_toast_title'),
        description: tConfig('orgAi.saved_toast_desc_policy'),
      });
    } catch (mutationError) {
      toast({
        title: tConfig('orgAi.save_failed_title'),
        description:
          mutationError instanceof Error
            ? mutationError.message
            : tConfig('orgAi.save_failed_title'),
        variant: 'destructive',
      });
    }
  }

  async function persistFeatureToggle(id: AiFeatureId, next: boolean) {
    const mapping = FEATURE_SETTING_MAP[id];
    if (!mapping) return;

    const payload =
      mapping.type === 'assistant'
        ? { assistantEnabled: next }
        : { capabilities: { [mapping.key]: next } };

    try {
      await updateSettings.mutateAsync(payload);
      toast({
        title: tConfig('orgAi.saved_toast_title'),
        description: tConfig('orgAi.saved_toast_desc_policy'),
      });
    } catch (mutationError) {
      toast({
        title: tConfig('orgAi.save_failed_title'),
        description:
          mutationError instanceof Error
            ? mutationError.message
            : tConfig('orgAi.save_failed_title'),
        variant: 'destructive',
      });
    }
  }

  function isFeatureEnabled(id: AiFeatureId) {
    const mapping = FEATURE_SETTING_MAP[id];
    if (!mapping || !workspaceSettings) return true;
    if (mapping.type === 'assistant') return workspaceSettings.assistantEnabled;
    return workspaceSettings.capabilities[mapping.key] ?? false;
  }

  if (isLoading) {
    return <div className="text-muted-foreground p-4 text-sm">{t('loading')}</div>;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="text-destructive py-8 text-sm">
          {error instanceof Error ? error.message : tConfig('orgAi.load_error')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="text-primary h-5 w-5" />
          {t('aiTransparency.title')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t.rich('aiTransparency.subtitle', {
            link: (chunks) => (
              <Link
                href="/ai-model-cards"
                className="hover:text-foreground inline-flex items-center gap-0.5 underline"
                target="_blank"
              >
                {chunks}
                <ExternalLink className="h-3 w-3" />
              </Link>
            ),
          })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            {t('oversight.title')}
          </CardTitle>
          <CardDescription>{t('oversight.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {oversight === 'review_required'
                  ? t('oversight.reviewRequiredLabel')
                  : t('oversight.autoApplyLabel')}
              </p>
              <p className="text-muted-foreground max-w-md text-xs">
                {oversight === 'review_required'
                  ? t('oversight.reviewRequiredDescription')
                  : t('oversight.autoApplyDescription')}
              </p>
            </div>
            <Switch
              checked={oversight === 'auto'}
              onCheckedChange={(v) => persistOversight(v ? 'auto' : 'review_required')}
              disabled={!canManage || updateSettings.isPending}
              aria-label={t('oversight.toggleAria')}
              data-testid="ai-oversight-toggle"
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-semibold uppercase tracking-wide">
          {t('features.heading')}
        </h2>
        <div className="space-y-3">
          {AI_FEATURE_MODEL_CARDS.map((card) => (
            <Card key={card.id} data-testid={`ai-feature-${card.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {card.name}
                      {!card.userFacing && (
                        <Badge variant="muted" size="sm">
                          {t('features.backgroundBadge')}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">{card.summary}</CardDescription>
                  </div>
                  <Switch
                    checked={isFeatureEnabled(card.id)}
                    onCheckedChange={(v) => persistFeatureToggle(card.id, v)}
                    disabled={
                      !canManage || updateSettings.isPending || !FEATURE_SETTING_MAP[card.id]
                    }
                    aria-label={t('features.toggleFeatureAria', { name: card.name })}
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-xs sm:grid-cols-2">
                <Field label={t('features.modelLabel')}>
                  <span className="text-foreground font-mono">{card.defaultModel}</span>{' '}
                  <span className="text-muted-foreground">({card.defaultProvider})</span>
                </Field>
                <Field label={t('features.defaultOversightLabel')}>
                  <Badge
                    variant={card.defaultOversight === 'review_required' ? 'info' : 'muted'}
                    size="sm"
                  >
                    {card.defaultOversight === 'review_required'
                      ? t('features.reviewRequiredBadge')
                      : t('features.autoApplyBadge')}
                  </Badge>
                </Field>
                <Field label={t('features.dataSentLabel')} className="sm:col-span-2">
                  <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
                    {card.dataSent.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </Field>
                <Field label={t('features.retentionLabel')} className="sm:col-span-2">
                  <p className="text-muted-foreground inline-flex items-start gap-1.5">
                    <Clock3 className="mt-0.5 h-3 w-3 shrink-0" />
                    {card.retention}
                  </p>
                </Field>
                <div className="pt-1 sm:col-span-2">
                  <Link
                    href={`/ai-model-cards#${card.id}`}
                    target="_blank"
                    className="hover:text-foreground inline-flex items-center gap-1 text-xs underline"
                  >
                    {t('features.readModelCard')}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="text-muted-foreground flex items-center gap-2 py-4 text-xs">
          <Database className="h-3.5 w-3.5" />
          <span>
            {t.rich('features.footer', {
              userFacing: USER_FACING_AI_FEATURES.length,
              total: AI_FEATURE_MODEL_CARDS.length,
              strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
              em: (chunks) => <em>{chunks}</em>,
            })}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">{label}</p>
      <div>{children}</div>
    </div>
  );
}
