'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAdminAgentControl, useAdminAgentStream, useUpdateAdminAgentControl } from '@/lib/hooks/use-agents';
import { Bot, Cpu, ExternalLink, Loader2, Shield, Sparkles, Wifi, WifiOff, Zap } from 'lucide-react';

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

function formatRunKind(kind: string) {
  return kind.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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

function formatCredentialSource(source: 'workspace' | 'server_env' | null) {
  if (source === 'workspace') return 'Workspace secret';
  if (source === 'server_env') return 'Server env';
  return 'Not configured';
}

export function AgentOpsPanel() {
  const { data, isLoading, error } = useAdminAgentControl();
  const stream = useAdminAgentStream();
  const updateControl = useUpdateAdminAgentControl();
  const { toast } = useToast();
  const [formState, setFormState] = useState<AgentControlForm>(EMPTY_FORM);

  useEffect(() => {
    if (data?.settings) {
      setFormState(data.settings);
    }
  }, [data]);

  const hasChanges = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(data?.settings || EMPTY_FORM),
    [data?.settings, formState]
  );

  async function handleSave() {
    try {
      await updateControl.mutateAsync(formState);
      toast({
        title: 'Agent control updated',
        description: 'Global agent safety and runtime controls were saved.',
      });
    } catch (mutationError) {
      toast({
        title: 'Failed to update agent control',
        description: mutationError instanceof Error ? mutationError.message : 'Failed to update agent control',
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Loading AI ops...</div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load AI ops.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Enabled workspaces" value={data.stats.enabledWorkspaceCount} icon={Bot} />
        <StatCard title="Enabled projects" value={data.stats.enabledProjectCount} icon={Sparkles} />
        <StatCard title="Running now" value={data.stats.runningRuns} icon={Zap} />
        <StatCard title="Recent failures" value={data.stats.failedRuns} icon={Shield} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader>
            <CardTitle>System service status</CardTitle>
            <CardDescription>Actual runtime gates for the agent control plane.</CardDescription>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider coverage</CardTitle>
            <CardDescription>Workspace-level provider selection and runnable coverage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Runnable workspaces</p>
                <p className="mt-2 text-2xl font-semibold">{data.stats.readyWorkspaceCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Enabled workspaces with provider access</p>
              </div>
              <div className="rounded-lg border border-border/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Blocked workspaces</p>
                <p className="mt-2 text-2xl font-semibold">{data.stats.blockedWorkspaceCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Enabled workspaces missing runnable provider state</p>
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(data.providerBreakdown).length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  No workspace provider data yet.
                </div>
              ) : (
                Object.entries(data.providerBreakdown).map(([provider, item]) => (
                  <div key={provider} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium capitalize">{provider}</span>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{item.total} total</Badge>
                        <Badge variant="outline">{item.enabled} enabled</Badge>
                        <Badge variant={item.blocked > 0 ? 'destructive' : 'default'}>{item.ready} ready</Badge>
                        {item.blocked > 0 ? <Badge variant="secondary">{item.blocked} blocked</Badge> : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Workspace coverage</CardTitle>
            <CardDescription>Real workspace-by-workspace readiness, credential source, and recent failure visibility.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.workspaceCoverage.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                No workspace AI coverage data yet.
              </div>
            ) : (
              data.workspaceCoverage.map((workspace) => (
                <div key={workspace.organizationId} className="rounded-lg border border-border/60 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{workspace.organizationName}</span>
                        <Badge variant={workspace.workspaceEnabled ? 'outline' : 'secondary'}>
                          {workspace.workspaceEnabled ? 'Workspace on' : 'Workspace off'}
                        </Badge>
                        <Badge variant={workspace.providerStatus.ready ? 'default' : 'destructive'}>
                          {workspace.providerStatus.ready ? 'Runnable' : 'Blocked'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{workspace.provider}</span>
                        <span>·</span>
                        <span>{workspace.model || 'No model'}</span>
                        {workspace.selectedModelConfigName ? (
                          <>
                            <span>·</span>
                            <span>{workspace.selectedModelConfigName}</span>
                          </>
                        ) : null}
                        <span>·</span>
                        <span>{workspace.executionMode}</span>
                        <span>·</span>
                        <span>{workspace.enabledProjects} enabled projects</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{workspace.providerStatus.summary}</p>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground lg:text-right">
                      <div>{formatCredentialSource(workspace.providerStatus.source)}</div>
                      <div>{workspace.providerStatus.label || 'No credential label'}</div>
                      <div>
                        {workspace.lastRunAt
                          ? `Last run ${formatDistanceToNow(new Date(workspace.lastRunAt), { addSuffix: true })}`
                          : 'No runs yet'}
                      </div>
                    </div>
                  </div>
                  {workspace.lastFailure ? (
                    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      Last failure: {workspace.lastFailure}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Where to manage what</CardTitle>
            <CardDescription>Clear separation between global controls, workspace credentials, and project behavior.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 font-medium">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Admin AI Ops
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Global pause, write guardrails, auto-mode supervision, concurrency, live execution feed, and cross-workspace rollout monitoring.
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 font-medium">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                Workspace AI settings
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Provider choice, saved model registry, model profile selection, API key storage, workspace write policy, capability defaults, and readiness checks.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/settings?tab=ai-agents">
                  Open workspace settings
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                Project AI settings
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Project enablement, project write policy, sprint capacity, live run buttons, run gate, and project-level live telemetry.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global AI guardrails</CardTitle>
          <CardDescription>One place to pause every agent or force the whole system back into supervised mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
              <div>
                <div className="font-medium">Global enablement</div>
                <p className="text-sm text-muted-foreground">Turn off all workspace and project agent runs from one switch.</p>
              </div>
              <Switch
                checked={formState.globalEnabled}
                onCheckedChange={(checked) => setFormState((current) => ({ ...current, globalEnabled: checked }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
              <div>
                <div className="font-medium">Allow write actions globally</div>
                <p className="text-sm text-muted-foreground">Force every sprint creation and backlog edit into preview if disabled.</p>
              </div>
              <Switch
                checked={formState.allowWriteActions}
                onCheckedChange={(checked) =>
                  setFormState((current) => ({ ...current, allowWriteActions: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
              <div>
                <div className="font-medium">Require supervision in auto mode</div>
                <p className="text-sm text-muted-foreground">Even autonomous projects stay preview-first when this is enabled.</p>
              </div>
              <Switch
                checked={formState.requireSupervisionForAutoMode}
                onCheckedChange={(checked) =>
                  setFormState((current) => ({ ...current, requireSupervisionForAutoMode: checked }))
                }
              />
            </div>
          </div>

          <div className="max-w-xs space-y-2">
            <label htmlFor="max-concurrent-runs" className="text-sm font-medium">
              Max concurrent runs
            </label>
            <Input
              id="max-concurrent-runs"
              type="number"
              min={1}
              max={50}
              value={formState.maxConcurrentRuns}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  maxConcurrentRuns: Math.max(1, Number.parseInt(event.target.value || '1', 10) || 1),
                }))
              }
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setFormState(data.settings)}
              disabled={!hasChanges || updateControl.isPending}
            >
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || updateControl.isPending}>
              {updateControl.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Save control plane
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Live execution feed</CardTitle>
              <CardDescription>Real-time status and logs from every agent run happening right now.</CardDescription>
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
              No agent runs are active right now.
            </div>
          ) : (
            stream.liveRuns.map((run) => {
              const runMeta = data.recentRuns.find((item) => item.id === run.executionId);

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
                      <div className="text-sm text-muted-foreground">
                        {runMeta?.organizationName || 'Unknown workspace'}
                        {runMeta?.projectName ? ` · ${runMeta.projectName}` : ''}
                        {runMeta?.initiatedBy ? ` · ${runMeta.initiatedBy}` : ''}
                      </div>
                      {runMeta?.summary ? <p className="text-sm text-muted-foreground">{runMeta.summary}</p> : null}
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

                  <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-muted/10">
                    {run.logs.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">Waiting for agent logs…</div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {run.logs.map((log) => (
                          <div key={`${run.executionId}-${log.logIndex}`} className="flex gap-3 px-3 py-2 text-xs">
                            <span className="w-16 shrink-0 text-muted-foreground">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={log.type === 'stderr' ? 'font-mono text-destructive' : 'font-mono'}>
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

      <Card>
        <CardHeader>
          <CardTitle>Recent agent runs</CardTitle>
          <CardDescription>System-wide history for monitoring rollout quality and blast radius.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.recentRuns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
              No agent runs have been recorded yet.
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
                    <div className="text-sm text-muted-foreground">
                      {run.organizationName || 'Unknown workspace'}
                      {run.projectName ? ` · ${run.projectName}` : ''}
                      {run.initiatedBy ? ` · ${run.initiatedBy}` : ''}
                    </div>
                    {run.summary ? <p className="text-sm text-muted-foreground">{run.summary}</p> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: typeof Bot;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
