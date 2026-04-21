'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAdminAgentControl, useAdminAgentStream, useUpdateAdminAgentControl } from '@/lib/hooks/use-agents';
import { cn } from '@/lib/utils';
import type { ComponentType } from 'react';
import {
  Bot,
  Cpu,
  ExternalLink,
  Loader2,
  Shield,
  Sparkles,
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
    return <div className="surface-card p-6 text-sm text-muted-foreground">Loading agent control...</div>;
  }

  if (error || !data) {
    return (
      <div className="surface-card p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load agent control.'}
      </div>
    );
  }

  const kpis: Array<{ label: string; value: number; icon: ComponentType<{ className?: string }> }> = [
    { label: 'Enabled workspaces', value: data.stats.enabledWorkspaceCount, icon: Bot },
    { label: 'Enabled projects', value: data.stats.enabledProjectCount, icon: Sparkles },
    { label: 'Running now', value: data.stats.runningRuns, icon: Zap },
    { label: 'Recent failures', value: data.stats.failedRuns, icon: Shield },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      {/* KPIs */}
      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="surface-card flex flex-col justify-between gap-2 p-4">
            <div className="flex items-center justify-between">
              <p className="kicker">{label}</p>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Global guardrails (primary section) */}
      <section className="space-y-3">
        <SectionHeader
          title="Global guardrails"
          description="One place to pause every agent or force the system into supervised mode."
        />
        <div className="surface-card p-6 space-y-5">
          <div className="space-y-0.5">
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
                className="flex items-center justify-between gap-4 rounded-md py-3 px-1 border-b border-border/50 last:border-b-0"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{detail}</p>
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
                Max concurrent runs
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
                    maxConcurrentRuns: Math.max(1, Number.parseInt(event.target.value || '1', 10) || 1),
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
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || updateControl.isPending}
              >
                {updateControl.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Service status + Provider coverage */}
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="surface-card p-6 space-y-3">
          <SectionHeader
            title="Service status"
            description="Runtime gates for the agent control plane."
            inline
          />
          <ul className="stagger divide-y divide-border/50">
            {data.serviceStatus.map((service) => (
              <li key={service.key} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-medium">{service.label}</p>
                  <p className="text-xs text-muted-foreground">{service.detail}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className={`status-dot ${serviceStatusDot(service.state)}`} />
                  <span className="text-xs text-muted-foreground capitalize">{service.state}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-card p-6 space-y-3">
          <SectionHeader
            title="Provider coverage"
            description="Workspace provider selection and runnable coverage."
            inline
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="kicker">Runnable</p>
              <p className="text-2xl font-semibold tabular-nums">{data.stats.readyWorkspaceCount}</p>
              <p className="text-xs text-muted-foreground">With provider access</p>
            </div>
            <div className="space-y-1">
              <p className="kicker">Blocked</p>
              <p className="text-2xl font-semibold tabular-nums">{data.stats.blockedWorkspaceCount}</p>
              <p className="text-xs text-muted-foreground">Missing provider state</p>
            </div>
          </div>
          {Object.entries(data.providerBreakdown).length === 0 ? (
            <p className="pt-2 text-xs text-muted-foreground">No provider data yet.</p>
          ) : (
            <ul className="stagger space-y-1 pt-2 border-t border-border/50">
              {Object.entries(data.providerBreakdown).map(([provider, item]) => (
                <li
                  key={provider}
                  className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5"
                >
                  <span className="text-sm font-medium capitalize">{provider}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="chip">{item.total} total</span>
                    <span className="chip">{item.enabled} on</span>
                    <span className={cn('chip', item.ready > 0 && 'chip-accent')}>
                      {item.ready} ready
                    </span>
                    {item.blocked > 0 && (
                      <span className="inline-flex items-center rounded-full border border-accent-rose/20 bg-accent-rose/10 px-2 py-0.5 text-[11px] font-medium text-accent-rose">
                        {item.blocked} blocked
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
          title="Workspace coverage"
          description="Per-workspace readiness, credential source, and recent failure visibility."
        />
        <div className="surface-card p-4 space-y-0.5">
          {data.workspaceCoverage.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No workspace AI coverage data yet.
            </p>
          ) : (
            <ul className="stagger divide-y divide-border/50">
              {data.workspaceCoverage.map((workspace) => (
                <li key={workspace.organizationId} className="py-3 px-1 space-y-1">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium truncate">{workspace.organizationName}</span>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            workspace.providerStatus.ready
                              ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20'
                              : 'bg-accent-rose/10 text-accent-rose border-accent-rose/20'
                          )}
                        >
                          {workspace.providerStatus.ready ? 'Runnable' : 'Blocked'}
                        </span>
                        <span className="chip">{workspace.workspaceEnabled ? 'On' : 'Off'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {workspace.provider} · {workspace.model || 'No model'} · {workspace.executionMode} · {workspace.enabledProjects} projects
                      </p>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground lg:text-right space-y-0.5">
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
                      <p className="mt-1 rounded-md bg-accent-amber/10 border border-accent-amber/20 px-3 py-2 text-xs text-accent-amber">
                        {workspace.lastFailure}
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
          title="Where to manage what"
          description="Clear separation between global controls, workspace credentials, and project behavior."
        />
        <div className="surface-card p-4">
          <ul className="stagger divide-y divide-border/50">
            {[
              {
                icon: Shield,
                label: 'Admin agent control',
                detail: 'Global pause, write guardrails, auto-mode supervision, concurrency, live feed.',
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
                detail: 'Project enablement, sprint capacity, live run buttons, project-level telemetry.',
                link: null,
              },
            ].map(({ icon: Icon, label, detail, link }) => (
              <li
                key={label}
                className="flex items-start justify-between gap-3 px-1 py-3"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </div>
                </div>
                {link && (
                  <Button asChild variant="ghost" size="sm" className="shrink-0">
                    <Link href={link}>
                      Open
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
            title="Live execution feed"
            description="Real-time status and logs from every agent run happening right now."
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className={cn('status-dot', stream.isConnected ? 'status-live animate-pulse-subtle' : 'status-warn')} />
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
                {formatDistanceToNow(new Date(stream.lastEventAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        <div className="surface-card p-4 space-y-3">
          {stream.liveRuns.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No agent runs are active right now.
            </p>
          ) : (
            <ul className="space-y-3">
              {stream.liveRuns.map((run) => {
                const runMeta = data.recentRuns.find((item) => item.id === run.executionId);
                return (
                  <li key={run.executionId} className="rounded-md bg-surface p-4 space-y-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {runMeta ? formatRunKind(runMeta.kind) : `Run ${run.executionId.slice(0, 8)}`}
                          </span>
                          <RunStatusChip status={run.status} />
                          {runMeta && <span className="chip">{runMeta.dryRun ? 'Preview' : 'Live'}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
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
                        <span className="tabular-nums">{Math.max(0, Math.min(100, Math.round(run.progress)))}%</span>
                      </div>
                      <Progress value={Math.max(0, Math.min(100, Math.round(run.progress)))} />
                    </div>

                    <div className="max-h-40 overflow-y-auto rounded-md bg-surface-2">
                      {run.logs.length === 0 ? (
                        <p className="p-3 text-xs text-muted-foreground">Waiting for agent logs...</p>
                      ) : (
                        <ul className="divide-y divide-border/40">
                          {run.logs.map((log) => (
                            <li
                              key={`${run.executionId}-${log.logIndex}`}
                              className="flex gap-3 px-3 py-1.5 text-xs"
                            >
                              <span className="w-16 shrink-0 font-mono text-muted-foreground">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                              <span
                                className={cn(
                                  'font-mono break-all',
                                  log.type === 'stderr' && 'text-destructive'
                                )}
                              >
                                {log.content}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {run.error && <p className="text-xs text-destructive">{run.error}</p>}
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
          title="Recent agent runs"
          description="System-wide history for monitoring rollout quality and blast radius."
        />
        <div className="surface-card p-4">
          {data.recentRuns.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No agent runs have been recorded yet.
            </p>
          ) : (
            <ul className="stagger divide-y divide-border/50">
              {data.recentRuns.map((run) => (
                <li
                  key={run.id}
                  className="flex items-start justify-between gap-4 px-1 py-2.5 transition-colors hover:bg-accent/40 rounded-md"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{formatRunKind(run.kind)}</span>
                      <RunStatusChip status={run.status} />
                      <span className="chip">{run.dryRun ? 'Preview' : 'Live'}</span>
                      {run.writeActionsCount > 0 && (
                        <span className="chip">{run.writeActionsCount} writes</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {run.organizationName || 'Unknown workspace'}
                      {run.projectName ? ` · ${run.projectName}` : ''}
                      {run.initiatedBy ? ` · ${run.initiatedBy}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground font-mono">
                    {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
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
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function RunStatusChip({ status }: { status: string }) {
  const tone =
    status === 'completed'
      ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20'
      : status === 'failed'
        ? 'bg-accent-rose/10 text-accent-rose border-accent-rose/20'
        : status === 'running'
          ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/20'
          : 'bg-muted text-muted-foreground border-border';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
        tone
      )}
    >
      {status}
    </span>
  );
}
