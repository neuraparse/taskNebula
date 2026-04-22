'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useProjectAgents, useProjectAgentStream, useRunProjectAgent, useUpdateProjectAgents } from '@/lib/hooks/use-agents';
import { AGENT_CAPABILITY_DETAILS, normalizeProjectAgentSettings, type ProjectAgentSettings } from '@/lib/agents/config';
import { Activity, ArrowRight, Bot, Clock3, Cpu, Loader2, Play, Radar, ShieldCheck, Sparkles, Wand2, Wifi, WifiOff } from 'lucide-react';

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

function formatRunKind(kind: string) {
  return kind.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCredentialSource(source: 'workspace' | 'platform' | 'server_env' | null) {
  if (source === 'workspace') {
    return 'Workspace secret';
  }

  if (source === 'platform') {
    return 'Platform default';
  }

  if (source === 'server_env') {
    return 'Server env';
  }

  return 'Not configured';
}

function formatServiceStateLabel(state: 'ready' | 'blocked' | 'disabled' | 'preview') {
  if (state === 'ready') return 'Ready';
  if (state === 'blocked') return 'Blocked';
  if (state === 'disabled') return 'Disabled';
  return 'Preview';
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
      label: 'Open AI Ops',
    };
  }

  if (issue.scope === 'workspace' || issue.scope === 'provider') {
    return {
      href: '/settings?tab=ai-agents',
      label: 'Open workspace AI settings',
    };
  }

  if (issue.scope === 'project') {
    return {
      href: `/projects/${projectId}/settings?tab=ai-agents`,
      label: 'Open project AI settings',
    };
  }

  return null;
}

export function ProjectAiAgents({ projectId }: { projectId: string }) {
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
        title: 'Project AI agents updated',
        description: 'Project-level execution and capability rules were saved.',
      });
    } catch (mutationError) {
      toast({
        title: 'Failed to save project AI agents',
        description: mutationError instanceof Error ? mutationError.message : 'Failed to save project AI agents',
        variant: 'destructive',
      });
    }
  }

  async function handleRun(kind: 'project_tracking' | 'backlog_triage' | 'sprint_planning' | 'bulk_sprint_creation', dryRun = true) {
    try {
      const result = await runAgent.mutateAsync({ kind, dryRun });
      toast({
        title: dryRun || result.forcedDryRun ? 'Preview ready' : 'Agent run completed',
        description: result.run.summary || `${formatRunKind(kind)} finished.`,
      });
    } catch (mutationError) {
      toast({
        title: 'Failed to run project agent',
        description: mutationError instanceof Error ? mutationError.message : 'Failed to run project agent',
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading project AI agents...</div>;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load project AI agents.'}
        </CardContent>
      </Card>
    );
  }

  const canManage = data.access.canManage;
  const recentRunsById = new Map(data.recentRuns.map((run) => [run.id, run]));
  const runBlockedReason = !canManage
    ? 'You need project management access to run agents.'
    : data.runAvailability.reason;
  const blockingIssues = data.configIssues.filter((issue) => issue.blocksRuns);
  const nonBlockingIssues = data.configIssues.filter((issue) => !issue.blocksRuns);

  function getRunDisabledReason(capabilityKey: keyof NonNullable<typeof data>['effectiveSettings']['capabilities']) {
    if (!data) {
      return 'Loading project AI agents.';
    }
    if (!data.effectiveSettings.capabilities[capabilityKey]) {
      return 'This capability is disabled in project policy.';
    }

    if (runBlockedReason) {
      return runBlockedReason;
    }

    if (runAgent.isPending) {
      return 'A run is already in progress.';
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
                <CardTitle>Project agents</CardTitle>
                <Badge variant="outline">{data.project.key}</Badge>
              </div>
              <CardDescription>
                Shape how AI handles backlog triage, planning, and project follow-up inside this project.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={data.effectiveSettings.enabled ? 'default' : 'secondary'}>
                {data.effectiveSettings.enabled ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline">{data.effectiveSettings.provider}</Badge>
              <Badge variant="outline">{data.effectiveSettings.executionMode}</Badge>
              {data.selectedModelConfig ? <Badge variant="outline">{data.selectedModelConfig.name}</Badge> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Run gate</CardTitle>
              <CardDescription>These checks decide whether a project run can start right now and where to fix blocked prerequisites.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.configIssues.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                  This project is fully configured for AI runs. Start with a preview and then move into live writes when needed.
                </div>
              ) : (
                data.configIssues.map((issue) => {
                  const action = getProjectIssueAction(projectId, issue);

                  return (
                    <div key={`${issue.code}-${issue.scope}`} className="rounded-lg border border-border/60 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{issue.title}</span>
                            <Badge variant={getIssueBadgeVariant(issue.severity)}>
                              {issue.blocksRuns ? 'Blocks runs' : issue.severity === 'warning' ? 'Needs review' : 'Policy note'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{issue.detail}</p>
                          <p className="text-xs text-muted-foreground">{issue.resolution}</p>
                        </div>
                        {action ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={action.href}>
                              {action.label}
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
                <div className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-4 py-3 text-sm text-accent-amber">
                  {runBlockedReason}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <RuntimeStatCard
              icon={Activity}
              label="Running now"
              value={String(data.runtimeSummary.runningRuns)}
              detail="Active runs for this project"
            />
            <RuntimeStatCard
              icon={Cpu}
              label="Provider"
              value={data.effectiveSettings.provider}
              detail={data.providerStatus.ready ? 'Runnable now' : 'Blocked'}
            />
            <RuntimeStatCard
              icon={Clock3}
              label="Last completed"
              value={
                data.runtimeSummary.lastCompletedAt
                  ? formatDistanceToNow(new Date(data.runtimeSummary.lastCompletedAt), { addSuffix: true })
                  : 'None yet'
              }
              detail="Most recent successful or preview completion"
            />
            <RuntimeStatCard
              icon={ShieldCheck}
              label="Write mode"
              value={data.effectiveSettings.allowWriteActions ? 'Enabled' : 'Preview'}
              detail={
                data.effectiveSettings.allowWriteActions
                  ? data.effectiveSettings.requireApprovalForWrites
                    ? 'Approval still required'
                    : 'Live writes available'
                  : 'Writes are forced into preview'
              }
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Runtime policy</CardTitle>
                <CardDescription>Project overrides can further restrict what the workspace allows.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                    <div>
                      <div className="font-medium">Enable project agents</div>
                      <p className="text-sm text-muted-foreground">Turns agent runs on for this project.</p>
                    </div>
                    <Switch
                      checked={formState.enabled}
                      onCheckedChange={(checked) => setFormState((current) => ({ ...current, enabled: checked }))}
                      disabled={!canManage}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                    <div>
                      <div className="font-medium">Inherit workspace defaults</div>
                      <p className="text-sm text-muted-foreground">Keep provider, execution mode, and capabilities aligned with workspace policy.</p>
                    </div>
                    <Switch
                      checked={formState.inheritWorkspaceDefaults}
                      onCheckedChange={(checked) =>
                        setFormState((current) => ({ ...current, inheritWorkspaceDefaults: checked }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                    <div>
                      <div className="font-medium">Allow write actions</div>
                      <p className="text-sm text-muted-foreground">Required for backlog edits and creating sprint batches.</p>
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
                    <Label>Execution mode</Label>
                    <Select
                      value={formState.executionMode}
                      onValueChange={(value) =>
                        setFormState((current) => ({ ...current, executionMode: value as ProjectAgentSettings['executionMode'] }))
                      }
                      disabled={!canManage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="assistive">Assistive</SelectItem>
                        <SelectItem value="auto">Autonomous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issue-capacity">Issues per sprint</Label>
                    <Input
                      id="issue-capacity"
                      type="number"
                      min={3}
                      max={50}
                      value={formState.issueCapacityPerSprint}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          issueCapacityPerSprint: Math.max(3, Number.parseInt(event.target.value || '3', 10) || 3),
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="batch-size">Sprint batch size</Label>
                    <Input
                      id="batch-size"
                      type="number"
                      min={1}
                      max={6}
                      value={formState.sprintBatchSize}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          sprintBatchSize: Math.max(1, Number.parseInt(event.target.value || '1', 10) || 1),
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sprint-length">Sprint length (days)</Label>
                    <Input
                      id="sprint-length"
                      type="number"
                      min={7}
                      max={30}
                      value={formState.sprintLengthDays}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          sprintLengthDays: Math.max(7, Number.parseInt(event.target.value || '7', 10) || 7),
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex w-full items-center justify-between rounded-lg border border-border/60 p-4">
                      <div>
                        <div className="font-medium">Auto-assign backlog</div>
                        <p className="text-sm text-muted-foreground">Place issues into planned sprints when batches are created.</p>
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
                  <CardTitle className="text-base">Effective controls</CardTitle>
                  <CardDescription>The final policy after workspace and admin safeguards are applied.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <MetricRow label="Enabled" value={data.effectiveSettings.enabled ? 'Yes' : 'No'} />
                  <MetricRow label="Provider" value={`${data.effectiveSettings.provider} · ${data.effectiveSettings.model}`} />
                  <MetricRow
                    label="Model profile"
                    value={
                      data.selectedModelConfig
                        ? `${data.selectedModelConfig.name} · ${data.selectedModelConfig.revisionCount} rev`
                        : 'Manual workspace model'
                    }
                  />
                  <MetricRow label="Provider readiness" value={data.providerStatus.ready ? 'Ready' : 'Needs attention'} />
                  <MetricRow label="Credential source" value={formatCredentialSource(data.providerStatus.source)} />
                  <MetricRow label="Credential" value={data.providerStatus.label || 'None'} />
                  <MetricRow label="Write actions" value={data.effectiveSettings.allowWriteActions ? 'Allowed' : 'Preview only'} />
                  <MetricRow label="Approval guard" value={data.effectiveSettings.requireApprovalForWrites ? 'Required' : 'Not required'} />
                  <MetricRow label="Daily run limit" value={String(data.effectiveSettings.dailyRunLimit)} />
                  <MetricRow label="Project role" value={data.access.projectRole || data.access.orgRole || 'viewer'} />
                  {data.providerStatus.updatedAt ? (
                    <MetricRow label="Credential updated" value={new Date(data.providerStatus.updatedAt).toLocaleString()} />
                  ) : null}
                  {data.selectedModelConfig ? (
                    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
                      Workspace is using the saved profile <span className="font-medium text-foreground">{data.selectedModelConfig.name}</span>.
                      {data.selectedModelConfig.description ? ` ${data.selectedModelConfig.description}` : ''}
                    </div>
                  ) : null}
                  {!data.providerStatus.ready ? (
                    <div className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">
                      {data.providerStatus.summary}
                    </div>
                  ) : null}
                  {blockingIssues.length > 0 ? (
                    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
                      {blockingIssues.length} blocking setup item{blockingIssues.length === 1 ? '' : 's'} must be fixed before a run can start.
                    </div>
                  ) : null}
                  {nonBlockingIssues.length > 0 ? (
                    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
                      {nonBlockingIssues.length} policy note{nonBlockingIssues.length === 1 ? '' : 's'} still affect write behavior and autonomy.
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">Service status</CardTitle>
                  <CardDescription>Concrete execution gates for this project.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.serviceStatus.map((service) => (
                    <div key={service.key} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{service.label}</span>
                        <Badge variant={getServiceBadgeVariant(service.state)}>
                          {formatServiceStateLabel(service.state)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{service.detail}</p>
                    </div>
                  ))}
                  {data.runtimeSummary.lastFailure ? (
                    <div className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">
                      Last failure: {data.runtimeSummary.lastFailure}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Capabilities</CardTitle>
              <CardDescription>Each capability can be narrowed further than the workspace default.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(AGENT_CAPABILITY_DETAILS).map(([key, details]) => (
                <div key={key} className="flex flex-col gap-4 rounded-lg border border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{details.label}</span>
                      {details.writes.length > 0 ? (
                        <Badge variant="outline">{details.writes.join(' · ')}</Badge>
                      ) : (
                        <Badge variant="secondary">Read only</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{details.description}</p>
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
              <CardTitle className="text-base">Manual runs</CardTitle>
              <CardDescription>Run previews safely, then move to live writes when the project is ready.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <RunCard
                title="Project health scan"
                description="Read-only scan for overdue, blocked, and unassigned work."
                icon={Activity}
                onPreview={() => handleRun('project_tracking', true)}
                previewLabel="Run scan"
                reason={getRunDisabledReason('project_tracking')}
                lastRun={data.lastRunByKind.project_tracking}
              />
              <RunCard
                title="Backlog triage"
                description="Refresh issue priority and add triage labels across the backlog."
                icon={Radar}
                onPreview={() => handleRun('backlog_triage', true)}
                onLive={() => handleRun('backlog_triage', false)}
                reason={getRunDisabledReason('backlog_triage')}
                lastRun={data.lastRunByKind.backlog_triage}
              />
              <RunCard
                title="Sprint planning preview"
                description="Prepare the next sprint batch without writing to the project."
                icon={Bot}
                onPreview={() => handleRun('sprint_planning', true)}
                previewLabel="Preview plan"
                reason={getRunDisabledReason('sprint_planning')}
                lastRun={data.lastRunByKind.sprint_planning}
              />
              <RunCard
                title="Bulk sprint creation"
                description="Create planned sprints in sequence and optionally pre-assign backlog issues."
                icon={Wand2}
                onPreview={() => handleRun('bulk_sprint_creation', true)}
                onLive={() => handleRun('bulk_sprint_creation', false)}
                reason={getRunDisabledReason('bulk_sprint_creation')}
                lastRun={data.lastRunByKind.bulk_sprint_creation}
              />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">Live runtime</CardTitle>
                  <CardDescription>Real-time status and logs for runs happening in this project right now.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={stream.isConnected ? 'outline' : 'secondary'} className="gap-1">
                    {stream.isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {stream.isConnected ? 'Stream connected' : 'Stream reconnecting'}
                  </Badge>
                  {stream.lastEventAt ? (
                    <Badge variant="outline">
                      Last event {formatDistanceToNow(new Date(stream.lastEventAt), { addSuffix: true })}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {stream.liveRuns.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  No active runs right now. Start a preview to watch progress and logs appear here.
                </div>
              ) : (
                stream.liveRuns.map((run) => {
                  const runMeta = recentRunsById.get(run.executionId);

                  return (
                    <div key={run.executionId} className="rounded-lg border border-border/60 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {runMeta ? formatRunKind(runMeta.kind) : `Run ${run.executionId.slice(0, 8)}`}
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
                            {runMeta ? <Badge variant="outline">{runMeta.dryRun ? 'Preview' : 'Live'}</Badge> : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {runMeta?.summary || 'Run is active. Logs will stream below as the agent works.'}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Updated {formatDistanceToNow(new Date(run.updatedAt), { addSuffix: true })}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span>{Math.max(0, Math.min(100, Math.round(run.progress)))}%</span>
                        </div>
                        <Progress value={Math.max(0, Math.min(100, Math.round(run.progress)))} />
                      </div>

                      <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-border/60 bg-muted/10">
                        {run.logs.length === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground">Waiting for agent logs…</div>
                        ) : (
                          <div className="divide-y divide-border/50">
                            {run.logs.map((log) => (
                              <div key={`${run.executionId}-${log.logIndex}`} className="flex gap-3 px-3 py-2 text-xs">
                                <span className="w-16 shrink-0 text-muted-foreground">
                                  {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span
                                  className={
                                    log.type === 'stderr'
                                      ? 'font-mono text-destructive'
                                      : 'font-mono text-foreground/90'
                                  }
                                >
                                  {log.content}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {run.error ? <p className="mt-3 text-sm text-destructive">{run.error}</p> : null}
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
                  <CardTitle className="text-base">Recent runs</CardTitle>
                  <CardDescription>Most recent agent runs for this project, including previews and live writes.</CardDescription>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setFormState(normalizeProjectAgentSettings(data.projectSettings))}
                    disabled={!hasChanges || updateAgents.isPending}
                  >
                    Reset
                  </Button>
                  <Button onClick={handleSave} disabled={!hasChanges || !canManage || updateAgents.isPending}>
                    {updateAgents.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Save project policy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentRuns.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  No agent runs yet. Start with a project health scan or sprint planning preview.
                </div>
              ) : (
                data.recentRuns.map((run) => (
                  <div key={run.id} className="rounded-lg border border-border/60 p-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{formatRunKind(run.kind)}</span>
                          <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                            {run.status}
                          </Badge>
                          <Badge variant="outline">{run.dryRun ? 'Preview' : 'Live'}</Badge>
                          {run.writeActionsCount > 0 ? <Badge variant="outline">{run.writeActionsCount} writes</Badge> : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{run.summary || 'No summary recorded.'}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    {run.error ? <p className="mt-3 text-sm text-destructive">{run.error}</p> : null}
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
  previewLabel = 'Preview',
  reason,
  lastRun,
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
}) {
  const disabled = Boolean(reason);

  return (
    <div className="rounded-lg border border-border/60 p-4">
      <div className="mb-3 flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {lastRun ? (
        <div className="mt-3 rounded-lg border border-border/60 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={lastRun.status === 'completed' ? 'default' : lastRun.status === 'failed' ? 'destructive' : 'secondary'}>
              {lastRun.status}
            </Badge>
            <Badge variant="outline">{lastRun.dryRun ? 'Preview' : 'Live'}</Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(lastRun.createdAt), { addSuffix: true })}
            </span>
          </div>
          {lastRun.summary ? <p className="mt-2 text-sm text-muted-foreground">{lastRun.summary}</p> : null}
          {lastRun.error ? <p className="mt-2 text-sm text-destructive">{lastRun.error}</p> : null}
        </div>
      ) : null}
      {reason ? <p className="mt-3 text-xs text-muted-foreground">{reason}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onPreview} disabled={disabled}>
          <Play className="mr-2 h-3.5 w-3.5" />
          {previewLabel}
        </Button>
        {onLive ? (
          <Button size="sm" onClick={onLive} disabled={disabled}>
            Run live
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-3 py-2">
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
    <div className="rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
