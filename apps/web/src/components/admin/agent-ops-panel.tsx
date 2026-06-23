'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  useAdminAgentControl,
  useAdminLocalAgentRunners,
  useAdminAgentStream,
  useUpdateAdminLocalAgentRunner,
  useUpdateAdminAgentControl,
} from '@/lib/hooks/use-agents';
import { PlatformAiCredentials } from './platform-ai-credentials';
import { AgentGovernancePanel } from '@/components/settings/agent-governance-panel';
import { useOrganization } from '@/lib/hooks/use-organization';
import { cn } from '@/lib/utils';
import { formatAgentRunKind } from '@/lib/agents/run-kind-labels';
import { formatAgentRunDisplayText, formatAgentRunStatus } from '@/lib/agents/i18n';
import type { ComponentType } from 'react';
import {
  Bot,
  Cpu,
  ExternalLink,
  Loader2,
  Shield,
  Sparkles,
  TerminalSquare,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';

type AgentControlForm = {
  globalEnabled: boolean;
  allowWriteActions: boolean;
  requireSupervisionForAutoMode: boolean;
  maxConcurrentRuns: number;
};

const EMPTY_FORM: AgentControlForm = {
  globalEnabled: true,
  allowWriteActions: true,
  requireSupervisionForAutoMode: true,
  maxConcurrentRuns: 6,
};

function serviceStatusDot(state: 'ready' | 'blocked' | 'disabled' | 'preview') {
  if (state === 'ready') return 'status-live';
  if (state === 'blocked') return 'status-danger';
  if (state === 'disabled') return 'status-idle';
  return 'status-warn';
}

function credentialSourceKey(source: 'workspace' | 'platform' | 'server_env' | null) {
  if (source === 'workspace') return 'agentOps.credentialSource.workspace';
  if (source === 'platform') return 'agentOps.credentialSource.platform';
  if (source === 'server_env') return 'agentOps.credentialSource.serverEnv';
  return 'agentOps.credentialSource.notConfigured';
}

function adminServiceKey(key: string) {
  if (key === 'control-plane') return 'controlPlane';
  if (key === 'live-monitoring') return 'liveMonitoring';
  if (key === 'write-pipeline') return 'writePipeline';
  if (key === 'provider-coverage') return 'providerCoverage';
  return 'unknown';
}

function adminServiceStateKey(state: 'ready' | 'blocked' | 'disabled' | 'preview') {
  if (state === 'ready') return 'agentOps.serviceStatus.states.ready';
  if (state === 'blocked') return 'agentOps.serviceStatus.states.blocked';
  if (state === 'disabled') return 'agentOps.serviceStatus.states.disabled';
  return 'agentOps.serviceStatus.states.preview';
}

export function AgentOpsPanel() {
  const t = useTranslations('adminPanels');
  const tSettings = useTranslations('settingsConfig');
  const tRunKind = useTranslations('agentRunKinds');
  const formatter = useFormatter();
  const { data, isLoading, error } = useAdminAgentControl();
  const stream = useAdminAgentStream();
  const updateControl = useUpdateAdminAgentControl();
  const { currentOrganizationId } = useOrganization();
  const localRunners = useAdminLocalAgentRunners(currentOrganizationId);
  const updateLocalRunner = useUpdateAdminLocalAgentRunner(currentOrganizationId || '');
  const { toast } = useToast();
  const [formState, setFormState] = useState<AgentControlForm>(EMPTY_FORM);

  useEffect(() => {
    if (data?.settings) setFormState(data.settings);
  }, [data]);

  const hasChanges = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(data?.settings || EMPTY_FORM),
    [data?.settings, formState]
  );

  async function handleSave() {
    try {
      await updateControl.mutateAsync(formState);
      toast({
        title: t('agentOps.controlUpdated'),
        description: t('agentOps.controlUpdatedDescription'),
      });
    } catch {
      toast({
        title: t('agentOps.controlUpdateFailed'),
        description: t('agentOps.controlUpdateFailed'),
        variant: 'destructive',
      });
    }
  }

  async function handleLocalRunnerToggle(provider: 'claude' | 'codex', enabled: boolean) {
    if (!currentOrganizationId) return;
    try {
      await updateLocalRunner.mutateAsync({ provider, enabled });
      toast({
        title: t('agentOps.localRunners.updated'),
        description: t('agentOps.localRunners.updatedDescription'),
      });
    } catch {
      toast({
        title: t('agentOps.localRunners.updateFailed'),
        description: t('agentOps.localRunners.updateFailed'),
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return (
      <div className="surface-card text-muted-foreground p-6 text-sm">{t('agentOps.loading')}</div>
    );
  }

  if (error || !data) {
    return (
      <div className="surface-card text-destructive p-6 text-sm">{t('agentOps.loadError')}</div>
    );
  }

  const controlData = data;

  function getAdminServiceDetail(key: string) {
    if (key === 'control-plane') {
      return controlData.settings.globalEnabled
        ? t('agentOps.serviceStatus.items.controlPlane.readyDetail')
        : t('agentOps.serviceStatus.items.controlPlane.disabledDetail');
    }

    if (key === 'live-monitoring') {
      return t('agentOps.serviceStatus.items.liveMonitoring.readyDetail');
    }

    if (key === 'write-pipeline') {
      return controlData.settings.allowWriteActions
        ? t('agentOps.serviceStatus.items.writePipeline.readyDetail')
        : t('agentOps.serviceStatus.items.writePipeline.previewDetail');
    }

    if (key === 'provider-coverage') {
      return t('agentOps.serviceStatus.items.providerCoverage.detail', {
        ready: controlData.stats.readyWorkspaceCount,
        total: controlData.stats.enabledWorkspaceCount,
      });
    }

    return t('agentOps.serviceStatus.items.unknown.detail');
  }

  const kpis: Array<{
    label: string;
    value: number;
    icon: ComponentType<{ className?: string }>;
    tone: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose';
  }> = [
    {
      label: t('agentOps.kpi.enabledWorkspaces'),
      value: data.stats.enabledWorkspaceCount,
      icon: Bot,
      tone: 'blue',
    },
    {
      label: t('agentOps.kpi.enabledProjects'),
      value: data.stats.enabledProjectCount,
      icon: Sparkles,
      tone: 'violet',
    },
    {
      label: t('agentOps.kpi.runningNow'),
      value: data.stats.runningRuns,
      icon: Zap,
      tone: 'emerald',
    },
    {
      label: t('agentOps.kpi.recentFailures'),
      value: data.stats.failedRuns,
      icon: Shield,
      tone: 'rose',
    },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      {/* KPIs */}
      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="surface-card flex max-h-[140px] flex-col justify-between gap-2 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="kicker truncate">{label}</p>
              <span className={cn('icon-tile', `icon-tile-accent-${tone}`)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Global guardrails (primary section) */}
      <section className="space-y-3">
        <SectionHeader
          title={t('agentOps.guardrails.title')}
          description={t('agentOps.guardrails.description')}
        />
        <div className="surface-card space-y-5 p-6">
          <div className="space-y-0.5">
            {[
              {
                key: 'globalEnabled' as const,
                label: t('agentOps.guardrails.globalEnablement'),
                detail: t('agentOps.guardrails.globalEnablementDetail'),
              },
              {
                key: 'allowWriteActions' as const,
                label: t('agentOps.guardrails.allowWriteActions'),
                detail: t('agentOps.guardrails.allowWriteActionsDetail'),
              },
              {
                key: 'requireSupervisionForAutoMode' as const,
                label: t('agentOps.guardrails.requireSupervision'),
                detail: t('agentOps.guardrails.requireSupervisionDetail'),
              },
            ].map(({ key, label, detail }) => (
              <div
                key={key}
                className="border-border/50 flex items-center justify-between gap-4 rounded-md border-b px-1 py-3 last:border-b-0"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-muted-foreground text-xs">{detail}</p>
                </div>
                <Switch
                  checked={formState[key]}
                  onCheckedChange={(checked) =>
                    setFormState((current) => ({ ...current, [key]: checked }))
                  }
                  aria-label={label}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="max-concurrent-runs" className="text-sm font-medium">
                {t('agentOps.guardrails.maxConcurrentRuns')}
              </Label>
              <Input
                id="max-concurrent-runs"
                type="number"
                min={1}
                max={50}
                value={formState.maxConcurrentRuns}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    maxConcurrentRuns: Math.max(
                      1,
                      Number.parseInt(event.target.value || '1', 10) || 1
                    ),
                  }))
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormState(data.settings)}
                disabled={!hasChanges || updateControl.isPending}
              >
                {t('agentOps.reset')}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || updateControl.isPending}
              >
                {updateControl.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    {t('agentOps.saving')}
                  </>
                ) : (
                  t('agentOps.save')
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {currentOrganizationId ? (
        <section>
          <AgentGovernancePanel organizationId={currentOrganizationId} />
        </section>
      ) : null}

      {/* Platform-default provider keys */}
      <section>
        <PlatformAiCredentials />
      </section>

      {currentOrganizationId ? (
        <section className="space-y-3">
          <SectionHeader
            title={t('agentOps.localRunners.title')}
            description={t('agentOps.localRunners.description')}
          />
          <div className="surface-card space-y-3 p-4">
            {localRunners.isLoading ? (
              <p className="text-muted-foreground px-2 py-4 text-sm">
                {t('agentOps.localRunners.loading')}
              </p>
            ) : localRunners.error ? (
              <p className="text-destructive px-2 py-4 text-sm">
                {localRunners.error instanceof Error
                  ? t('agentOps.localRunners.loadError')
                  : t('agentOps.localRunners.loadError')}
              </p>
            ) : (
              <ul className="divide-border/50 divide-y">
                {(localRunners.data?.providers ?? []).map((runner) => (
                  <li key={runner.provider} className="space-y-2 px-1 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="icon-tile icon-tile-accent-blue">
                            <TerminalSquare className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-sm font-medium">
                            {t(`agentOps.localRunners.providers.${runner.provider}`)}
                          </span>
                          <span
                            className={cn(
                              runner.configured ? 'chip-emerald' : 'chip-rose',
                              runner.enabled && !runner.configured && 'realtime-ping'
                            )}
                          >
                            {runner.configured
                              ? t('agentOps.localRunners.ready')
                              : t('agentOps.localRunners.needsSetup')}
                          </span>
                          <span className="chip">
                            {runner.enabled
                              ? t('agentOps.workspaceCoverage.on')
                              : t('agentOps.workspaceCoverage.off')}
                          </span>
                        </div>
                        <p className="text-muted-foreground break-all text-xs">
                          {runner.command} · {runner.cwd}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {t('agentOps.localRunners.runtime', {
                            mode: runner.mode || t('agentOps.localRunners.defaultMode'),
                            timeout: runner.timeoutSeconds || 0,
                          })}
                        </p>
                      </div>
                      <Switch
                        checked={runner.enabled}
                        onCheckedChange={(checked) =>
                          handleLocalRunnerToggle(runner.provider, checked)
                        }
                        disabled={updateLocalRunner.isPending}
                        aria-label={t('agentOps.localRunners.toggle', {
                          provider: t(`agentOps.localRunners.providers.${runner.provider}`),
                        })}
                      />
                    </div>
                    {runner.reasonCode ? (
                      <p className="panel-warn px-3 py-2 text-xs">
                        {t(`agentOps.localRunners.reason.${runner.reasonCode}`, {
                          value: runner.reasonDetail || '',
                        })}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {/* Service status + Provider coverage */}
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="surface-card space-y-3 p-6">
          <SectionHeader
            title={t('agentOps.serviceStatus.title')}
            description={t('agentOps.serviceStatus.description')}
            inline
          />
          <ul className="stagger divide-border/50 divide-y">
            {data.serviceStatus.map((service) => (
              <li key={service.key} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-medium">
                    {t(`agentOps.serviceStatus.items.${adminServiceKey(service.key)}.label`)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {getAdminServiceDetail(service.key)}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className={`status-dot ${serviceStatusDot(service.state)}`} />
                  <span className="text-muted-foreground text-xs">
                    {t(adminServiceStateKey(service.state))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-card space-y-3 p-6">
          <SectionHeader
            title={t('agentOps.providerCoverage.title')}
            description={t('agentOps.providerCoverage.description')}
            inline
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="kicker">{t('agentOps.providerCoverage.runnable')}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {data.stats.readyWorkspaceCount}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('agentOps.providerCoverage.withProviderAccess')}
              </p>
            </div>
            <div className="space-y-1">
              <p className="kicker">{t('agentOps.providerCoverage.blocked')}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {data.stats.blockedWorkspaceCount}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('agentOps.providerCoverage.missingProviderState')}
              </p>
            </div>
          </div>
          {Object.entries(data.providerBreakdown).length === 0 ? (
            <p className="text-muted-foreground pt-2 text-xs">
              {t('agentOps.providerCoverage.noData')}
            </p>
          ) : (
            <ul className="stagger border-border/50 space-y-1 border-t pt-2">
              {Object.entries(data.providerBreakdown).map(([provider, item]) => (
                <li
                  key={provider}
                  className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5"
                >
                  <span className="text-sm font-medium capitalize">{provider}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="chip">
                      {t('agentOps.providerCoverage.totalChip', { count: item.total })}
                    </span>
                    <span className="chip">
                      {t('agentOps.providerCoverage.onChip', { count: item.enabled })}
                    </span>
                    <span className={cn('chip', item.ready > 0 && 'chip-accent')}>
                      {t('agentOps.providerCoverage.readyChip', { count: item.ready })}
                    </span>
                    {item.blocked > 0 && (
                      <span className="chip-rose realtime-ping">
                        {t('agentOps.providerCoverage.blockedChip', { count: item.blocked })}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Workspace coverage */}
      <section className="space-y-3">
        <SectionHeader
          title={t('agentOps.workspaceCoverage.title')}
          description={t('agentOps.workspaceCoverage.description')}
        />
        <div className="surface-card space-y-0.5 p-4">
          {data.workspaceCoverage.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">
              {t('agentOps.workspaceCoverage.noData')}
            </p>
          ) : (
            <ul className="stagger divide-border/50 divide-y">
              {data.workspaceCoverage.map((workspace) => (
                <li key={workspace.organizationId} className="space-y-1 px-1 py-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {workspace.organizationName}
                        </span>
                        <span
                          className={cn(
                            workspace.providerStatus.ready ? 'chip-emerald' : 'chip-rose'
                          )}
                        >
                          {workspace.providerStatus.ready
                            ? t('agentOps.workspaceCoverage.runnable')
                            : t('agentOps.workspaceCoverage.blocked')}
                        </span>
                        <span className="chip">
                          {workspace.workspaceEnabled
                            ? t('agentOps.workspaceCoverage.on')
                            : t('agentOps.workspaceCoverage.off')}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate text-xs">
                        {workspace.provider} ·{' '}
                        {workspace.model || t('agentOps.workspaceCoverage.noModel')} ·{' '}
                        {workspace.executionMode} ·{' '}
                        {t('agentOps.workspaceCoverage.projectsCount', {
                          count: workspace.enabledProjects,
                        })}
                      </p>
                    </div>
                    <div className="text-muted-foreground shrink-0 space-y-0.5 text-xs lg:text-right">
                      <p>{t(credentialSourceKey(workspace.providerStatus.source))}</p>
                      <p>
                        {workspace.lastRunAt
                          ? t('agentOps.workspaceCoverage.lastRun', {
                              time: formatter.relativeTime(new Date(workspace.lastRunAt)),
                            })
                          : t('agentOps.workspaceCoverage.noRuns')}
                      </p>
                    </div>
                  </div>
                  {workspace.lastFailure ? (
                    <details>
                      <summary className="text-accent-amber cursor-pointer text-xs">
                        {t('agentOps.workspaceCoverage.lastFailure')}
                      </summary>
                      <p className="panel-warn mt-1 px-3 py-2 text-xs">
                        {formatAgentRunDisplayText(tSettings, workspace.lastFailure)}
                      </p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Where to manage what */}
      <section className="space-y-3">
        <SectionHeader
          title={t('agentOps.manage.title')}
          description={t('agentOps.manage.description')}
        />
        <div className="surface-card p-4">
          <ul className="stagger divide-border/50 divide-y">
            {[
              {
                icon: Shield,
                label: t('agentOps.manage.adminControl'),
                detail: t('agentOps.manage.adminControlDetail'),
                link: null,
              },
              {
                icon: Cpu,
                label: t('agentOps.manage.workspaceAi'),
                detail: t('agentOps.manage.workspaceAiDetail'),
                link: '/settings?tab=ai-agents',
              },
              {
                icon: Sparkles,
                label: t('agentOps.manage.projectAi'),
                detail: t('agentOps.manage.projectAiDetail'),
                link: null,
              },
            ].map(({ icon: Icon, label, detail, link }) => (
              <li key={label} className="flex items-start justify-between gap-3 px-1 py-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-muted-foreground text-xs">{detail}</p>
                  </div>
                </div>
                {link && (
                  <Button asChild variant="ghost" size="sm" className="shrink-0">
                    <Link href={link}>
                      {t('agentOps.open')}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Live execution feed */}
      <section className="space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader
            title={t('agentOps.liveFeed.title')}
            description={t('agentOps.liveFeed.description')}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  'status-dot',
                  stream.isConnected ? 'status-live animate-pulse-subtle' : 'status-warn'
                )}
              />
              {stream.isConnected ? (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Wifi className="h-3 w-3" /> {t('agentOps.liveFeed.connected')}
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <WifiOff className="h-3 w-3" /> {t('agentOps.liveFeed.reconnecting')}
                </span>
              )}
            </span>
            {stream.lastEventAt && (
              <span className="chip text-[11px]">
                {formatter.relativeTime(new Date(stream.lastEventAt))}
              </span>
            )}
          </div>
        </div>

        <div className="surface-card space-y-3 p-4">
          {stream.liveRuns.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">
              {t('agentOps.liveFeed.noActiveRuns')}
            </p>
          ) : (
            <ul className="space-y-3">
              {stream.liveRuns.map((run) => {
                const runMeta = data.recentRuns.find((item) => item.id === run.executionId);
                return (
                  <li key={run.executionId} className="bg-surface space-y-3 rounded-md p-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {runMeta
                              ? formatAgentRunKind(runMeta.kind, tRunKind)
                              : t('agentOps.runFallback', { id: run.executionId.slice(0, 8) })}
                          </span>
                          <RunStatusChip
                            status={run.status}
                            label={formatAgentRunStatus(tSettings, run.status)}
                          />
                          {runMeta && (
                            <span className="chip">
                              {runMeta.dryRun ? t('agentOps.preview') : t('agentOps.live')}
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground truncate text-xs">
                          {runMeta?.organizationName || t('agentOps.unknownWorkspace')}
                          {runMeta?.projectName ? ` · ${runMeta.projectName}` : ''}
                          {runMeta?.initiatedBy ? ` · ${runMeta.initiatedBy}` : ''}
                        </p>
                      </div>
                      <p className="text-muted-foreground shrink-0 text-xs">
                        {t('agentOps.updatedAgo', {
                          time: formatter.relativeTime(new Date(run.updatedAt)),
                        })}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="text-muted-foreground flex items-center justify-between text-xs">
                        <span>{t('agentOps.liveFeed.progress')}</span>
                        <span className="tabular-nums">
                          {Math.max(0, Math.min(100, Math.round(run.progress)))}%
                        </span>
                      </div>
                      <Progress value={Math.max(0, Math.min(100, Math.round(run.progress)))} />
                    </div>

                    <div className="bg-surface-2 max-h-40 overflow-y-auto rounded-md">
                      {run.logs.length === 0 ? (
                        <p className="text-muted-foreground p-3 text-xs">
                          {t('agentOps.liveFeed.waitingLogs')}
                        </p>
                      ) : (
                        <ul className="divide-border/40 divide-y">
                          {run.logs.map((log) => (
                            <li
                              key={`${run.executionId}-${log.logIndex}`}
                              className="flex gap-3 px-3 py-1.5 text-xs"
                            >
                              <span className="text-muted-foreground w-16 shrink-0 font-mono">
                                {formatter.dateTime(new Date(log.timestamp), {
                                  timeStyle: 'short',
                                })}
                              </span>
                              <span
                                className={cn(
                                  'break-all font-mono',
                                  log.type === 'stderr' && 'text-destructive'
                                )}
                              >
                                {formatAgentRunDisplayText(tSettings, log.content)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {run.error && (
                      <p className="text-destructive text-xs">
                        {formatAgentRunDisplayText(tSettings, run.error)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Recent runs */}
      <section className="space-y-3">
        <SectionHeader
          title={t('agentOps.recentRuns.title')}
          description={t('agentOps.recentRuns.description')}
        />
        <div className="surface-card p-4">
          {data.recentRuns.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">
              {t('agentOps.recentRuns.noData')}
            </p>
          ) : (
            <ul className="stagger divide-border/50 divide-y">
              {data.recentRuns.map((run) => (
                <li
                  key={run.id}
                  className="row-interactive flex items-start justify-between gap-4 px-1 py-2.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {formatAgentRunKind(run.kind, tRunKind)}
                      </span>
                      <RunStatusChip
                        status={run.status}
                        label={formatAgentRunStatus(tSettings, run.status)}
                      />
                      <span className="chip">
                        {run.dryRun ? t('agentOps.preview') : t('agentOps.live')}
                      </span>
                      {run.writeActionsCount > 0 && (
                        <span className="chip">
                          {t('agentOps.recentRuns.writesChip', { count: run.writeActionsCount })}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {run.organizationName || t('agentOps.unknownWorkspace')}
                      {run.projectName ? ` · ${run.projectName}` : ''}
                      {run.initiatedBy ? ` · ${run.initiatedBy}` : ''}
                    </p>
                  </div>
                  <p className="text-muted-foreground shrink-0 font-mono text-xs">
                    {formatter.relativeTime(new Date(run.createdAt))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  inline = false,
}: {
  title: string;
  description: string;
  inline?: boolean;
}) {
  return (
    <div className={cn(inline ? 'space-y-0.5' : 'space-y-1')}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-muted-foreground text-xs">{description}</p>
    </div>
  );
}

function RunStatusChip({ status, label }: { status: string; label: string }) {
  const toneClass =
    status === 'completed'
      ? 'chip-emerald'
      : status === 'failed'
        ? 'chip-rose'
        : status === 'running'
          ? 'chip-blue'
          : 'chip';
  return <span className={toneClass}>{label}</span>;
}
