'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAdminAgentControl, useAdminAgentStream, useUpdateAdminAgentControl } from '@/lib/hooks/use-agents';
import { Bot, Cpu, ExternalLink, Loader2, Shield, Sparkles, Wifi, WifiOff, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function serviceStatusDot(state: 'ready' | 'blocked' | 'disabled' | 'preview') {
  if (state === 'ready') return 'status-live';
  if (state === 'blocked') return 'status-danger';
  if (state === 'disabled') return 'status-idle';
  return 'status-warn';
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
    if (data?.settings) setFormState(data.settings);
  }, [data]);

  const hasChanges = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(data?.settings || EMPTY_FORM),
    [data?.settings, formState]
  );

  async function handleSave() {
    try {
      await updateControl.mutateAsync(formState);
      toast({ title: 'Agent control updated', description: 'Global agent safety and runtime controls were saved.' });
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
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load AI ops.'}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Key metrics */}
      <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Enabled workspaces', value: data.stats.enabledWorkspaceCount, icon: Bot },
          { title: 'Enabled projects', value: data.stats.enabledProjectCount, icon: Sparkles },
          { title: 'Running now', value: data.stats.runningRuns, icon: Zap },
          { title: 'Recent failures', value: data.stats.failedRuns, icon: Shield },
        ].map(({ title, value, icon: Icon }) => (
          <div key={title} className="surface-card flex items-center justify-between p-4">
            <div>
              <p className="kicker">{title}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        ))}
      </div>

      {/* Service status + Provider coverage */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="surface-card p-6 space-y-3">
          <h3 className="font-semibold">Service status</h3>
          <p className="text-xs text-muted-foreground">Runtime gates for the agent control plane.</p>
          <div className="space-y-2">
            {data.serviceStatus.map((service) => (
              <div
                key={service.key}
                className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className="text-sm font-medium">{service.label}</span>
                  <p className="text-xs text-muted-foreground">{service.detail}</p>
                </div>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className={`status-dot ${serviceStatusDot(service.state)}`} />
                  <span className="text-xs text-muted-foreground capitalize">{service.state}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-6 space-y-3">
          <h3 className="font-semibold">Provider coverage</h3>
          <p className="text-xs text-muted-foreground">Workspace provider selection and runnable coverage.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="kicker">Runnable workspaces</p>
              <p className="mt-1 text-2xl font-semibold">{data.stats.readyWorkspaceCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">With provider access</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="kicker">Blocked workspaces</p>
              <p className="mt-1 text-2xl font-semibold">{data.stats.blockedWorkspaceCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Missing provider state</p>
            </div>
          </div>
          {Object.entries(data.providerBreakdown).length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              No provider data yet.
            </p>
          ) : (
            <div className="space-y-px">
              {Object.entries(data.providerBreakdown).map(([provider, item]) => (
                <div
                  key={provider}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent/40 transition-colors"
                >
                  <span className="text-sm font-medium capitalize">{provider}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="chip">{item.total} total</span>
                    <span className="chip">{item.enabled} enabled</span>
                    <span className={cn('chip', item.ready > 0 && 'chip-accent')}>{item.ready} ready</span>
                    {item.blocked > 0 && (
                      <span className="rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        {item.blocked} blocked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workspace coverage */}
      <div className="surface-card p-6 space-y-3">
        <h3 className="font-semibold">Workspace coverage</h3>
        <p className="text-xs text-muted-foreground">
          Per-workspace readiness, credential source, and recent failure visibility.
        </p>
        {data.workspaceCoverage.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No workspace AI coverage data yet.
          </p>
        ) : (
          <div className="space-y-px">
            {data.workspaceCoverage.map((workspace) => (
              <div
                key={workspace.organizationId}
                className="rounded-md border border-border/60 p-3 space-y-2"
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{workspace.organizationName}</span>
                      <span className="chip">{workspace.workspaceEnabled ? 'On' : 'Off'}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium border',
                          workspace.providerStatus.ready
                            ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        )}
                      >
                        {workspace.providerStatus.ready ? 'Runnable' : 'Blocked'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {workspace.provider} · {workspace.model || 'No model'} · {workspace.executionMode} · {workspace.enabledProjects} projects
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground lg:text-right space-y-0.5 shrink-0">
                    <p>{formatCredentialSource(workspace.providerStatus.source)}</p>
                    <p>
                      {workspace.lastRunAt
                        ? `Last run ${formatDistanceToNow(new Date(workspace.lastRunAt), { addSuffix: true })}`
                        : 'No runs yet'}
                    </p>
                  </div>
                </div>
                {workspace.lastFailure ? (
                  <details>
                    <summary className="cursor-pointer text-xs text-accent-amber">Last failure</summary>
                    <p className="mt-1 rounded border border-accent-amber/20 bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">
                      {workspace.lastFailure}
                    </p>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Where to manage what */}
      <div className="surface-card p-6 space-y-3">
        <h3 className="font-semibold">Where to manage what</h3>
        <p className="text-xs text-muted-foreground">
          Clear separation between global controls, workspace credentials, and project behavior.
        </p>
        <div className="space-y-2">
          {[
            {
              icon: Shield,
              label: 'Admin AI Ops',
              detail: 'Global pause, write guardrails, auto-mode supervision, concurrency, live execution feed.',
              link: null,
            },
            {
              icon: Cpu,
              label: 'Workspace AI settings',
              detail: 'Provider choice, saved model registry, API key storage, workspace write policy.',
              link: '/settings?tab=ai-agents',
            },
            {
              icon: Sparkles,
              label: 'Project AI settings',
              detail: 'Project enablement, sprint capacity, live run buttons, and project-level telemetry.',
              link: null,
            },
          ].map(({ icon: Icon, label, detail, link }) => (
            <div key={label} className="rounded-md border border-border px-3 py-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                {link && (
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                    <Link href={link}>
                      Open
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground pl-6">{detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Global guardrails */}
      <div className="surface-card p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="font-semibold">Global AI guardrails</h3>
          <p className="text-xs text-muted-foreground">
            One place to pause every agent or force the system back into supervised mode.
          </p>
        </div>
        <div className="space-y-2">
          {[
            {
              key: 'globalEnabled' as const,
              label: 'Global enablement',
              detail: 'Turn off all workspace and project agent runs from one switch.',
            },
            {
              key: 'allowWriteActions' as const,
              label: 'Allow write actions globally',
              detail: 'Force every sprint creation and backlog edit into preview if disabled.',
            },
            {
              key: 'requireSupervisionForAutoMode' as const,
              label: 'Require supervision in auto mode',
              detail: 'Even autonomous projects stay preview-first when this is enabled.',
            },
          ].map(({ key, label, detail }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3 gap-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
              <Switch
                checked={formState[key]}
                onCheckedChange={(checked) =>
                  setFormState((current) => ({ ...current, [key]: checked }))
                }
              />
            </div>
          ))}
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
            size="sm"
          >
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || updateControl.isPending} size="sm">
            {updateControl.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              'Save control plane'
            )}
          </Button>
        </div>
      </div>

      {/* Live execution feed */}
      <div className="surface-card p-6 space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold">Live execution feed</h3>
            <p className="text-xs text-muted-foreground">
              Real-time status and logs from every agent run happening right now.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className={`status-dot ${stream.isConnected ? 'status-live' : 'status-warn'}`} />
              {stream.isConnected ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wifi className="h-3 w-3" /> Connected
                </span>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <WifiOff className="h-3 w-3" /> Reconnecting
                </span>
              )}
            </span>
            {stream.lastEventAt && (
              <span className="chip text-[11px]">
                Last event {formatDistanceToNow(new Date(stream.lastEventAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        {stream.liveRuns.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No agent runs are active right now.
          </p>
        ) : (
          <div className="space-y-3">
            {stream.liveRuns.map((run) => {
              const runMeta = data.recentRuns.find((item) => item.id === run.executionId);
              return (
                <div key={run.executionId} className="rounded-md border border-border p-4 space-y-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {runMeta ? formatRunKind(runMeta.kind) : `Run ${run.executionId.slice(0, 8)}`}
                        </span>
                        <span
                          className={cn(
                            'chip',
                            run.status === 'completed' && 'chip-accent',
                            run.status === 'failed' &&
                              'rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive'
                          )}
                        >
                          {run.status}
                        </span>
                        {runMeta && <span className="chip">{runMeta.dryRun ? 'Preview' : 'Live'}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {runMeta?.organizationName || 'Unknown workspace'}
                        {runMeta?.projectName ? ` · ${runMeta.projectName}` : ''}
                        {runMeta?.initiatedBy ? ` · ${runMeta.initiatedBy}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(run.updatedAt), { addSuffix: true })}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.max(0, Math.min(100, Math.round(run.progress)))}%</span>
                    </div>
                    <Progress value={Math.max(0, Math.min(100, Math.round(run.progress)))} />
                  </div>

                  <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-surface">
                    {run.logs.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">Waiting for agent logs...</p>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {run.logs.map((log) => (
                          <div
                            key={`${run.executionId}-${log.logIndex}`}
                            className="flex gap-3 px-3 py-1.5 text-xs"
                          >
                            <span className="w-14 shrink-0 text-muted-foreground">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span
                              className={
                                log.type === 'stderr' ? 'font-mono text-destructive' : 'font-mono'
                              }
                            >
                              {log.content}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {run.error && <p className="text-xs text-destructive">{run.error}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent runs */}
      <div className="surface-card p-6 space-y-3">
        <h3 className="font-semibold">Recent agent runs</h3>
        <p className="text-xs text-muted-foreground">
          System-wide history for monitoring rollout quality and blast radius.
        </p>
        {data.recentRuns.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No agent runs have been recorded yet.
          </p>
        ) : (
          <div className="space-y-px">
            {data.recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex min-h-[44px] items-start justify-between gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{formatRunKind(run.kind)}</span>
                    <span
                      className={cn(
                        'chip',
                        run.status === 'completed' && 'chip-accent',
                        run.status === 'failed' &&
                          'rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive'
                      )}
                    >
                      {run.status}
                    </span>
                    <span className="chip">{run.dryRun ? 'Preview' : 'Live'}</span>
                    {run.writeActionsCount > 0 && (
                      <span className="chip">{run.writeActionsCount} writes</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {run.organizationName || 'Unknown workspace'}
                    {run.projectName ? ` · ${run.projectName}` : ''}
                    {run.initiatedBy ? ` · ${run.initiatedBy}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
