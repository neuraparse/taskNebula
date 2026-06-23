'use client';

// QUAL-21 TS-strict-migration: file untouched intentionally; surfaces 4 errors
// under `exactOptionalPropertyTypes`. See docs/TS_STRICT_MIGRATION.md.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  useProjectAgents,
  useProjectAgentStream,
  useRunProjectAgent,
  useUpdateProjectAgents,
} from '@/lib/hooks/use-agents';
import {
  AGENT_CAPABILITY_DETAILS,
  normalizeProjectAgentSettings,
  type ProjectAgentSettings,
} from '@/lib/agents/config';
import { formatAgentRunKind } from '@/lib/agents/run-kind-labels';
import {
  Activity,
  ArrowRight,
  Bot,
  Clock3,
  Cpu,
  Loader2,
  Play,
  Radar,
  ShieldCheck,
  Sparkles,
  Wand2,
  Wifi,
  WifiOff,
} from 'lucide-react';

const EMPTY_SETTINGS: ProjectAgentSettings = {
  enabled: false,
  inheritWorkspaceDefaults: true,
  executionMode: 'assistive',
  allowWriteActions: false,
  sprintBatchSize: 2,
  sprintLengthDays: 14,
  issueCapacityPerSprint: 8,
  autoAssignToPlannedSprints: true,
  capabilities: {
    project_tracking: true,
    backlog_triage: true,
    sprint_planning: true,
    bulk_sprint_creation: true,
  },
};

function credentialSourceKey(source: 'workspace' | 'platform' | 'server_env' | null) {
  if (source === 'workspace') {
    return 'projectAi.cred_workspace_secret';
  }

  if (source === 'platform') {
    return 'projectAi.cred_platform_default';
  }

  if (source === 'server_env') {
    return 'projectAi.cred_server_env';
  }

  return 'projectAi.cred_not_configured';
}

function serviceStateLabelKey(state: 'ready' | 'blocked' | 'disabled' | 'preview') {
  if (state === 'ready') return 'projectAi.state_ready';
  if (state === 'blocked') return 'projectAi.state_blocked';
  if (state === 'disabled') return 'projectAi.state_disabled';
  return 'projectAi.state_preview';
}

function getServiceBadgeVariant(state: 'ready' | 'blocked' | 'disabled' | 'preview') {
  if (state === 'ready') return 'default' as const;
  if (state === 'blocked') return 'destructive' as const;
  return 'secondary' as const;
}

function getIssueBadgeVariant(severity: 'error' | 'warning' | 'info') {
  if (severity === 'error') return 'destructive' as const;
  if (severity === 'warning') return 'secondary' as const;
  return 'outline' as const;
}

function getProjectIssueAction(
  projectId: string,
  issue: {
    code: string;
    scope: 'system' | 'workspace' | 'project' | 'provider';
  }
) {
  if (issue.code === 'global_paused') {
    return {
      href: '/admin?tab=agents',
      labelKey: 'projectAi.open_ai_ops',
    };
  }

  if (issue.scope === 'workspace' || issue.scope === 'provider') {
    return {
      href: '/settings?tab=ai-agents',
      labelKey: 'projectAi.open_workspace_settings',
    };
  }

  if (issue.scope === 'project') {
    return {
      href: `/projects/${projectId}/settings?tab=ai-agents`,
      labelKey: 'projectAi.open_project_settings',
    };
  }

  return null;
}

export function ProjectAiAgents({ projectId }: { projectId: string }) {
  const t = useTranslations('settingsConfig');
  const tRunKind = useTranslations('agentRunKinds');
  const formatter = useFormatter();
  const { data, isLoading, error } = useProjectAgents(projectId);
  const stream = useProjectAgentStream(projectId, Boolean(data?.access.canView));
  const updateAgents = useUpdateProjectAgents(projectId);
  const runAgent = useRunProjectAgent(projectId);
  const { toast } = useToast();
  const [formState, setFormState] = useState<ProjectAgentSettings>(EMPTY_SETTINGS);

  useEffect(() => {
    if (data?.projectSettings) {
      setFormState(normalizeProjectAgentSettings(data.projectSettings));
    }
  }, [data]);

  const hasChanges = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(data?.projectSettings || EMPTY_SETTINGS),
    [data?.projectSettings, formState]
  );

  async function handleSave() {
    try {
      await updateAgents.mutateAsync(formState);
      toast({
        title: t('projectAi.updated_toast_title'),
        description: t('projectAi.updated_toast_desc'),
      });
    } catch (mutationError) {
      toast({
        title: t('projectAi.save_failed_title'),
        description:
          mutationError instanceof Error ? mutationError.message : t('projectAi.save_failed_title'),
        variant: 'destructive',
      });
    }
  }

  async function handleRun(
    kind: 'project_tracking' | 'backlog_triage' | 'sprint_planning' | 'bulk_sprint_creation',
    dryRun = true
  ) {
    try {
      const result = await runAgent.mutateAsync({ kind, dryRun });
      toast({
        title:
          dryRun || result.forcedDryRun
            ? t('projectAi.preview_ready')
            : t('projectAi.run_completed'),
        description:
          result.run.summary ||
          t('projectAi.run_finished', { kind: formatAgentRunKind(kind, tRunKind) }),
      });
    } catch (mutationError) {
      toast({
        title: t('projectAi.run_failed_title'),
        description:
          mutationError instanceof Error ? mutationError.message : t('projectAi.run_failed_title'),
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground p-4 text-sm">{t('projectAi.loading')}</div>;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="text-destructive py-8 text-sm">
          {error instanceof Error ? error.message : t('projectAi.load_error')}
        </CardContent>
      </Card>
    );
  }

  const canManage = data.access.canManage;
  const recentRunsById = new Map(data.recentRuns.map((run) => [run.id, run]));
  const runBlockedReason = !canManage
    ? t('projectAi.need_manage_access')
    : data.runAvailability.reason;
  const blockingIssues = data.configIssues.filter((issue) => issue.blocksRuns);
  const nonBlockingIssues = data.configIssues.filter((issue) => !issue.blocksRuns);

  function getRunDisabledReason(
    capabilityKey: keyof NonNullable<typeof data>['effectiveSettings']['capabilities']
  ) {
    if (!data) {
      return t('projectAi.loading');
    }
    if (!data.effectiveSettings.capabilities[capabilityKey]) {
      return t('projectAi.capability_disabled');
    }

    if (runBlockedReason) {
      return runBlockedReason;
    }

    if (runAgent.isPending) {
      return t('projectAi.run_in_progress');
    }

    return null;
  }

  return (
    <div className="animate-fade-up space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle>{t('projectAi.title')}</CardTitle>
                <Badge variant="outline">{data.project.key}</Badge>
              </div>
              <CardDescription>{t('projectAi.subtitle')}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={data.effectiveSettings.enabled ? 'default' : 'secondary'}>
                {data.effectiveSettings.enabled ? t('projectAi.active') : t('projectAi.inactive')}
              </Badge>
              <Badge variant="outline">{data.effectiveSettings.provider}</Badge>
              <Badge variant="outline">{data.effectiveSettings.executionMode}</Badge>
              {data.selectedModelConfig ? (
                <Badge variant="outline">{data.selectedModelConfig.name}</Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">{t('projectAi.run_gate')}</CardTitle>
              <CardDescription>{t('projectAi.run_gate_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.configIssues.length === 0 ? (
                <div className="border-border/60 bg-muted/10 text-muted-foreground rounded-lg border px-4 py-3 text-sm">
                  {t('projectAi.run_gate_ok')}
                </div>
              ) : (
                data.configIssues.map((issue) => {
                  const action = getProjectIssueAction(projectId, issue);

                  return (
                    <div
                      key={`${issue.code}-${issue.scope}`}
                      className="border-border/60 rounded-lg border p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{issue.title}</span>
                            <Badge variant={getIssueBadgeVariant(issue.severity)}>
                              {issue.blocksRuns
                                ? t('projectAi.blocks_runs')
                                : issue.severity === 'warning'
                                  ? t('projectAi.needs_review')
                                  : t('projectAi.policy_note')}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-sm">{issue.detail}</p>
                          <p className="text-muted-foreground text-xs">{issue.resolution}</p>
                        </div>
                        {action ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={action.href}>
                              {t(action.labelKey)}
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}

              {runBlockedReason ? (
                <div className="border-accent-amber/30 bg-accent-amber/10 text-accent-amber rounded-lg border px-4 py-3 text-sm">
                  {runBlockedReason}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <RuntimeStatCard
              icon={Activity}
              label={t('projectAi.stat_running_now')}
              value={String(data.runtimeSummary.runningRuns)}
              detail={t('projectAi.stat_running_now_detail')}
            />
            <RuntimeStatCard
              icon={Cpu}
              label={t('projectAi.stat_provider')}
              value={data.effectiveSettings.provider}
              detail={
                data.providerStatus.ready ? t('projectAi.runnable_now') : t('projectAi.blocked')
              }
            />
            <RuntimeStatCard
              icon={Clock3}
              label={t('projectAi.stat_last_completed')}
              value={
                data.runtimeSummary.lastCompletedAt
                  ? formatter.relativeTime(new Date(data.runtimeSummary.lastCompletedAt))
                  : t('projectAi.none_yet')
              }
              detail={t('projectAi.stat_last_completed_detail')}
            />
            <RuntimeStatCard
              icon={ShieldCheck}
              label={t('projectAi.stat_write_mode')}
              value={
                data.effectiveSettings.allowWriteActions
                  ? t('projectAi.enabled')
                  : t('projectAi.preview')
              }
              detail={
                data.effectiveSettings.allowWriteActions
                  ? data.effectiveSettings.requireApprovalForWrites
                    ? t('projectAi.approval_required')
                    : t('projectAi.live_writes_available')
                  : t('projectAi.writes_forced_preview')
              }
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">{t('projectAi.runtime_policy')}</CardTitle>
                <CardDescription>{t('projectAi.runtime_policy_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3">
                  <div className="border-border/60 flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="font-medium">{t('projectAi.enable_agents')}</div>
                      <p className="text-muted-foreground text-sm">
                        {t('projectAi.enable_agents_desc')}
                      </p>
                    </div>
                    <Switch
                      checked={formState.enabled}
                      onCheckedChange={(checked) =>
                        setFormState((current) => ({ ...current, enabled: checked }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div className="border-border/60 flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="font-medium">{t('projectAi.inherit_defaults')}</div>
                      <p className="text-muted-foreground text-sm">
                        {t('projectAi.inherit_defaults_desc')}
                      </p>
                    </div>
                    <Switch
                      checked={formState.inheritWorkspaceDefaults}
                      onCheckedChange={(checked) =>
                        setFormState((current) => ({
                          ...current,
                          inheritWorkspaceDefaults: checked,
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div className="border-border/60 flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="font-medium">{t('projectAi.allow_writes')}</div>
                      <p className="text-muted-foreground text-sm">
                        {t('projectAi.allow_writes_desc')}
                      </p>
                    </div>
                    <Switch
                      checked={formState.allowWriteActions}
                      onCheckedChange={(checked) =>
                        setFormState((current) => ({ ...current, allowWriteActions: checked }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('projectAi.execution_mode')}</Label>
                    <Select
                      value={formState.executionMode}
                      onValueChange={(value) =>
                        setFormState((current) => ({
                          ...current,
                          executionMode: value as ProjectAgentSettings['executionMode'],
                        }))
                      }
                      disabled={!canManage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">{t('projectAi.mode_manual')}</SelectItem>
                        <SelectItem value="assistive">{t('projectAi.mode_assistive')}</SelectItem>
                        <SelectItem value="auto">{t('projectAi.mode_autonomous')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issue-capacity">{t('projectAi.issues_per_sprint')}</Label>
                    <Input
                      id="issue-capacity"
                      type="number"
                      min={3}
                      max={50}
                      value={formState.issueCapacityPerSprint}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          issueCapacityPerSprint: Math.max(
                            3,
                            Number.parseInt(event.target.value || '3', 10) || 3
                          ),
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="batch-size">{t('projectAi.sprint_batch_size')}</Label>
                    <Input
                      id="batch-size"
                      type="number"
                      min={1}
                      max={6}
                      value={formState.sprintBatchSize}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          sprintBatchSize: Math.max(
                            1,
                            Number.parseInt(event.target.value || '1', 10) || 1
                          ),
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sprint-length">{t('projectAi.sprint_length')}</Label>
                    <Input
                      id="sprint-length"
                      type="number"
                      min={7}
                      max={30}
                      value={formState.sprintLengthDays}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          sprintLengthDays: Math.max(
                            7,
                            Number.parseInt(event.target.value || '7', 10) || 7
                          ),
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="border-border/60 flex w-full items-center justify-between rounded-lg border p-4">
                      <div>
                        <div className="font-medium">{t('projectAi.auto_assign')}</div>
                        <p className="text-muted-foreground text-sm">
                          {t('projectAi.auto_assign_desc')}
                        </p>
                      </div>
                      <Switch
                        checked={formState.autoAssignToPlannedSprints}
                        onCheckedChange={(checked) =>
                          setFormState((current) => ({
                            ...current,
                            autoAssignToPlannedSprints: checked,
                          }))
                        }
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">{t('projectAi.effective_controls')}</CardTitle>
                <CardDescription>{t('projectAi.effective_controls_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <MetricRow
                  label={t('projectAi.metric_enabled')}
                  value={data.effectiveSettings.enabled ? t('projectAi.yes') : t('projectAi.no')}
                />
                <MetricRow
                  label={t('projectAi.metric_provider')}
                  value={`${data.effectiveSettings.provider} · ${data.effectiveSettings.model}`}
                />
                <MetricRow
                  label={t('projectAi.metric_model_profile')}
                  value={
                    data.selectedModelConfig
                      ? `${data.selectedModelConfig.name} · ${t('projectAi.rev_count', { count: data.selectedModelConfig.revisionCount })}`
                      : t('projectAi.manual_workspace_model')
                  }
                />
                <MetricRow
                  label={t('projectAi.metric_provider_readiness')}
                  value={
                    data.providerStatus.ready
                      ? t('projectAi.ready')
                      : t('projectAi.needs_attention')
                  }
                />
                <MetricRow
                  label={t('projectAi.metric_credential_source')}
                  value={t(credentialSourceKey(data.providerStatus.source))}
                />
                <MetricRow
                  label={t('projectAi.metric_credential')}
                  value={data.providerStatus.label || t('projectAi.none')}
                />
                <MetricRow
                  label={t('projectAi.metric_write_actions')}
                  value={
                    data.effectiveSettings.allowWriteActions
                      ? t('projectAi.allowed')
                      : t('projectAi.preview_only')
                  }
                />
                <MetricRow
                  label={t('projectAi.metric_approval_guard')}
                  value={
                    data.effectiveSettings.requireApprovalForWrites
                      ? t('projectAi.required')
                      : t('projectAi.not_required')
                  }
                />
                <MetricRow
                  label={t('projectAi.metric_daily_limit')}
                  value={String(data.effectiveSettings.dailyRunLimit)}
                />
                <MetricRow
                  label={t('projectAi.metric_project_role')}
                  value={data.access.projectRole || data.access.orgRole || 'viewer'}
                />
                {data.providerStatus.updatedAt ? (
                  <MetricRow
                    label={t('projectAi.metric_credential_updated')}
                    value={new Date(data.providerStatus.updatedAt).toLocaleString()}
                  />
                ) : null}
                {data.selectedModelConfig ? (
                  <div className="border-border/60 bg-muted/10 text-muted-foreground rounded-lg border px-3 py-3 text-xs">
                    {t('projectAi.using_profile_prefix')}{' '}
                    <span className="text-foreground font-medium">
                      {data.selectedModelConfig.name}
                    </span>
                    .
                    {data.selectedModelConfig.description
                      ? ` ${data.selectedModelConfig.description}`
                      : ''}
                  </div>
                ) : null}
                {!data.providerStatus.ready ? (
                  <div className="border-accent-amber/30 bg-accent-amber/10 text-accent-amber rounded-lg border px-3 py-2 text-xs">
                    {data.providerStatus.summary}
                  </div>
                ) : null}
                {blockingIssues.length > 0 ? (
                  <div className="border-border/60 bg-muted/10 text-muted-foreground rounded-lg border px-3 py-3 text-xs">
                    {t('projectAi.blocking_items_note', { count: blockingIssues.length })}
                  </div>
                ) : null}
                {nonBlockingIssues.length > 0 ? (
                  <div className="border-border/60 bg-muted/10 text-muted-foreground rounded-lg border px-3 py-3 text-xs">
                    {t('projectAi.policy_notes_note', { count: nonBlockingIssues.length })}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">{t('projectAi.service_status')}</CardTitle>
                <CardDescription>{t('projectAi.service_status_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.serviceStatus.map((service) => (
                  <div key={service.key} className="border-border/60 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{service.label}</span>
                      <Badge variant={getServiceBadgeVariant(service.state)}>
                        {t(serviceStateLabelKey(service.state))}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">{service.detail}</p>
                  </div>
                ))}
                {data.runtimeSummary.lastFailure ? (
                  <div className="border-accent-amber/30 bg-accent-amber/10 text-accent-amber rounded-lg border px-3 py-2 text-xs">
                    {t('projectAi.last_failure', { error: data.runtimeSummary.lastFailure })}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">{t('projectAi.capabilities')}</CardTitle>
              <CardDescription>{t('projectAi.capabilities_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(AGENT_CAPABILITY_DETAILS).map(([key, details]) => (
                <div
                  key={key}
                  className="border-border/60 flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{details.label}</span>
                      {details.writes.length > 0 ? (
                        <Badge variant="outline">{details.writes.join(' · ')}</Badge>
                      ) : (
                        <Badge variant="secondary">{t('projectAi.read_only')}</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">{details.description}</p>
                  </div>
                  <Switch
                    checked={formState.capabilities[key as keyof typeof formState.capabilities]}
                    onCheckedChange={(checked) =>
                      setFormState((current) => ({
                        ...current,
                        capabilities: {
                          ...current.capabilities,
                          [key]: checked,
                        },
                      }))
                    }
                    disabled={!canManage}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">{t('projectAi.manual_runs')}</CardTitle>
              <CardDescription>{t('projectAi.manual_runs_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <RunCard
                title={t('projectAi.run_health_title')}
                description={t('projectAi.run_health_desc')}
                icon={Activity}
                onPreview={() => handleRun('project_tracking', true)}
                previewLabel={t('projectAi.run_scan')}
                reason={getRunDisabledReason('project_tracking')}
                lastRun={data.lastRunByKind.project_tracking}
                formatter={formatter}
                t={t}
              />
              <RunCard
                title={t('projectAi.run_triage_title')}
                description={t('projectAi.run_triage_desc')}
                icon={Radar}
                onPreview={() => handleRun('backlog_triage', true)}
                onLive={() => handleRun('backlog_triage', false)}
                reason={getRunDisabledReason('backlog_triage')}
                lastRun={data.lastRunByKind.backlog_triage}
                formatter={formatter}
                t={t}
              />
              <RunCard
                title={t('projectAi.run_planning_title')}
                description={t('projectAi.run_planning_desc')}
                icon={Bot}
                onPreview={() => handleRun('sprint_planning', true)}
                previewLabel={t('projectAi.preview_plan')}
                reason={getRunDisabledReason('sprint_planning')}
                lastRun={data.lastRunByKind.sprint_planning}
                formatter={formatter}
                t={t}
              />
              <RunCard
                title={t('projectAi.run_bulk_title')}
                description={t('projectAi.run_bulk_desc')}
                icon={Wand2}
                onPreview={() => handleRun('bulk_sprint_creation', true)}
                onLive={() => handleRun('bulk_sprint_creation', false)}
                reason={getRunDisabledReason('bulk_sprint_creation')}
                lastRun={data.lastRunByKind.bulk_sprint_creation}
                formatter={formatter}
                t={t}
              />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">{t('projectAi.live_runtime')}</CardTitle>
                  <CardDescription>{t('projectAi.live_runtime_desc')}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={stream.isConnected ? 'outline' : 'secondary'} className="gap-1">
                    {stream.isConnected ? (
                      <Wifi className="h-3 w-3" />
                    ) : (
                      <WifiOff className="h-3 w-3" />
                    )}
                    {stream.isConnected
                      ? t('projectAi.stream_connected')
                      : t('projectAi.stream_reconnecting')}
                  </Badge>
                  {stream.lastEventAt ? (
                    <Badge variant="outline">
                      {t('projectAi.last_event', {
                        ago: formatter.relativeTime(new Date(stream.lastEventAt)),
                      })}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {stream.liveRuns.length === 0 ? (
                <div className="border-border/60 text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
                  {t('projectAi.no_active_runs')}
                </div>
              ) : (
                stream.liveRuns.map((run) => {
                  const runMeta = recentRunsById.get(run.executionId);

                  return (
                    <div key={run.executionId} className="border-border/60 rounded-lg border p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {runMeta
                                ? formatAgentRunKind(runMeta.kind, tRunKind)
                                : t('projectAi.run_label', { id: run.executionId.slice(0, 8) })}
                            </span>
                            <Badge
                              variant={
                                run.status === 'completed'
                                  ? 'default'
                                  : run.status === 'failed'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {run.status}
                            </Badge>
                            {runMeta ? (
                              <Badge variant="outline">
                                {runMeta.dryRun ? t('projectAi.preview') : t('projectAi.live')}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {runMeta?.summary || t('projectAi.run_active_logs')}
                          </p>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t('projectAi.updated_ago', {
                            ago: formatter.relativeTime(new Date(run.updatedAt)),
                          })}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="text-muted-foreground flex items-center justify-between text-xs">
                          <span>{t('projectAi.progress')}</span>
                          <span>{Math.max(0, Math.min(100, Math.round(run.progress)))}%</span>
                        </div>
                        <Progress value={Math.max(0, Math.min(100, Math.round(run.progress)))} />
                      </div>

                      <div className="border-border/60 bg-muted/10 mt-4 max-h-56 overflow-y-auto rounded-lg border">
                        {run.logs.length === 0 ? (
                          <div className="text-muted-foreground p-3 text-sm">
                            {t('projectAi.waiting_logs')}
                          </div>
                        ) : (
                          <div className="divide-border/50 divide-y">
                            {run.logs.map((log) => (
                              <div
                                key={`${run.executionId}-${log.logIndex}`}
                                className="flex gap-3 px-3 py-2 text-xs"
                              >
                                <span className="text-muted-foreground w-16 shrink-0">
                                  {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span
                                  className={
                                    log.type === 'stderr'
                                      ? 'text-destructive font-mono'
                                      : 'text-foreground/90 font-mono'
                                  }
                                >
                                  {log.content}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {run.error ? (
                        <p className="text-destructive mt-3 text-sm">{run.error}</p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">{t('projectAi.recent_runs')}</CardTitle>
                  <CardDescription>{t('projectAi.recent_runs_desc')}</CardDescription>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFormState(normalizeProjectAgentSettings(data.projectSettings))
                    }
                    disabled={!hasChanges || updateAgents.isPending}
                  >
                    {t('projectAi.reset')}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || !canManage || updateAgents.isPending}
                  >
                    {updateAgents.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('projectAi.saving')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {t('projectAi.save_project_policy')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentRuns.length === 0 ? (
                <div className="border-border/60 text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
                  {t('projectAi.no_runs')}
                </div>
              ) : (
                data.recentRuns.map((run) => (
                  <div key={run.id} className="border-border/60 rounded-lg border p-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {formatAgentRunKind(run.kind, tRunKind)}
                          </span>
                          <Badge
                            variant={
                              run.status === 'completed'
                                ? 'default'
                                : run.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {run.status}
                          </Badge>
                          <Badge variant="outline">
                            {run.dryRun ? t('projectAi.preview') : t('projectAi.live')}
                          </Badge>
                          {run.writeActionsCount > 0 ? (
                            <Badge variant="outline">
                              {t('projectAi.writes_count', { count: run.writeActionsCount })}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {run.summary || t('projectAi.no_summary')}
                        </p>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {formatter.relativeTime(new Date(run.createdAt))}
                      </div>
                    </div>
                    {run.error ? (
                      <p className="text-destructive mt-3 text-sm">{run.error}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

function RunCard({
  title,
  description,
  icon: Icon,
  onPreview,
  onLive,
  previewLabel,
  reason,
  lastRun,
  formatter,
  t,
}: {
  title: string;
  description: string;
  icon: typeof Activity;
  onPreview: () => void;
  onLive?: () => void;
  previewLabel?: string;
  reason: string | null;
  lastRun?: {
    status: string;
    dryRun: boolean;
    summary: string | null;
    createdAt: string;
    error: string | null;
  };
  formatter: ReturnType<typeof useFormatter>;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const disabled = Boolean(reason);
  const resolvedPreviewLabel = previewLabel ?? t('projectAi.preview');

  return (
    <div className="border-border/60 rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2 font-medium">
        <Icon className="text-muted-foreground h-4 w-4" />
        {title}
      </div>
      <p className="text-muted-foreground text-sm">{description}</p>
      {lastRun ? (
        <div className="border-border/60 mt-3 rounded-lg border px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                lastRun.status === 'completed'
                  ? 'default'
                  : lastRun.status === 'failed'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {lastRun.status}
            </Badge>
            <Badge variant="outline">
              {lastRun.dryRun ? t('projectAi.preview') : t('projectAi.live')}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {formatter.relativeTime(new Date(lastRun.createdAt))}
            </span>
          </div>
          {lastRun.summary ? (
            <p className="text-muted-foreground mt-2 text-sm">{lastRun.summary}</p>
          ) : null}
          {lastRun.error ? <p className="text-destructive mt-2 text-sm">{lastRun.error}</p> : null}
        </div>
      ) : null}
      {reason ? <p className="text-muted-foreground mt-3 text-xs">{reason}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onPreview} disabled={disabled}>
          <Play className="mr-2 h-3.5 w-3.5" />
          {resolvedPreviewLabel}
        </Button>
        {onLive ? (
          <Button size="sm" onClick={onLive} disabled={disabled}>
            {t('projectAi.run_live')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function RuntimeStatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-border/60 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">{label}</p>
        <Icon className="text-muted-foreground h-4 w-4" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-muted-foreground mt-1 text-sm">{detail}</p>
    </div>
  );
}
