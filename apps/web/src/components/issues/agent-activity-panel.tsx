'use client';

import {
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Play,
  ShieldCheck,
  TerminalSquare,
  Workflow,
  XCircle,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useDispatchIssueAgent,
  useIssueAgentSessions,
  type AgentSessionProvider,
  type IssueAgentSession,
} from '@/lib/hooks/use-agents';
import { cn } from '@/lib/utils';

type AgentProviderKind = AgentSessionProvider;

const PROVIDERS: AgentProviderKind[] = [
  'codex',
  'claude',
  'cursor',
  'devin',
  'copilot',
  'openhands',
  'custom',
];

type LocalRunPayload = {
  command?: string;
  status?: string;
  exitCode?: number | null;
  signal?: string | null;
  cwd?: string;
};

function runnerStatusKey(status: string) {
  if (status === 'running') return 'running';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  return null;
}

function statusTone(state: string) {
  if (state === 'complete')
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (state === 'error') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (state === 'active')
    return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300';
  if (state === 'awaitingInput')
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-border bg-muted/50 text-muted-foreground';
}

function stateIcon(state: IssueAgentSession['state']) {
  if (state === 'complete') return CheckCircle2;
  if (state === 'error' || state === 'stale') return XCircle;
  if (state === 'active') return Loader2;
  return Clock3;
}

function readLocalRun(payload: Record<string, unknown>): LocalRunPayload | null {
  if (typeof payload.localRun !== 'object' || payload.localRun === null) return null;
  const localRun = payload.localRun as Record<string, unknown>;
  return {
    command: typeof localRun.command === 'string' ? localRun.command : undefined,
    status: typeof localRun.status === 'string' ? localRun.status : undefined,
    exitCode: typeof localRun.exitCode === 'number' ? localRun.exitCode : null,
    signal: typeof localRun.signal === 'string' ? localRun.signal : null,
    cwd: typeof localRun.cwd === 'string' ? localRun.cwd : undefined,
  };
}

interface AgentActivityPanelProps {
  issueId: string;
  agentProvider: AgentProviderKind | null;
  assigneeName?: string | null;
}

export function AgentActivityPanel({
  issueId,
  agentProvider,
  assigneeName,
}: AgentActivityPanelProps) {
  const t = useTranslations('issuePanels');
  const format = useFormatter();
  const [selectedProvider, setSelectedProvider] = useState<AgentProviderKind>(
    agentProvider ?? 'codex'
  );
  const [promptOverride, setPromptOverride] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sessionsQuery = useIssueAgentSessions(issueId);
  const dispatchAgent = useDispatchIssueAgent(issueId);
  const sessions = sessionsQuery.data?.sessions ?? [];
  const latestSession = sessions[0] ?? null;
  const latestLocalRun = latestSession ? readLocalRun(latestSession.payload) : null;
  const isDispatching = dispatchAgent.isPending;
  const formatRunnerStatus = (status: string) => {
    const key = runnerStatusKey(status);
    return key ? t(`agent.runnerStatuses.${key}`) : status;
  };

  useEffect(() => {
    if (agentProvider) setSelectedProvider(agentProvider);
  }, [agentProvider]);

  const onDispatch = async () => {
    setError(null);
    try {
      await dispatchAgent.mutateAsync({
        provider: selectedProvider,
        promptOverride: promptOverride.trim() || undefined,
      });
      setPromptOverride('');
    } catch (err) {
      setError(t('agent.dispatch_failed'));
    }
  };

  return (
    <section className="surface-card space-y-4 rounded-lg p-4 shadow-none">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="icon-tile icon-tile-accent-blue shrink-0">
            <Bot className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{t('agent.title')}</h3>
              <Badge variant="outline" className="h-5 rounded-sm px-1.5 text-[10px]">
                {t('agent.beta')}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {assigneeName
                ? t('agent.assignedTo', { name: assigneeName })
                : t('agent.directDispatch')}
            </p>
          </div>
        </div>
        {latestSession ? (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium',
              statusTone(latestSession.state),
              latestSession.state === 'active' && 'realtime-ping'
            )}
          >
            {(() => {
              const Icon = stateIcon(latestSession.state);
              return (
                <Icon
                  className={cn('h-3 w-3', latestSession.state === 'active' && 'animate-spin')}
                />
              );
            })()}
            {t(`agent.states.${latestSession.state}`)}
          </span>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { key: 'issueContext', icon: Workflow },
          { key: 'descriptionContext', icon: FileText },
          { key: 'instructionContext', icon: ShieldCheck },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className="border-border/60 bg-surface/50 flex min-h-16 flex-col justify-between rounded-md border px-2.5 py-2"
            >
              <Icon className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-[11px] font-medium leading-tight">
                {t(`agent.${item.key}`)}
              </span>
            </div>
          );
        })}
      </div>

      {latestSession ? (
        <div className="bg-muted/30 grid gap-2 rounded-md border border-dashed p-3 text-xs">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <span className="text-muted-foreground">{t('agent.sessionStatus')}</span>
            <span className="font-medium">{t(`agent.providers.${latestSession.provider}`)}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <span className="text-muted-foreground">{t('agent.runner')}</span>
            <span className="max-w-full truncate font-mono text-[11px] sm:max-w-[60%] sm:text-right">
              {latestLocalRun?.command
                ? t('agent.localRunner', { command: latestLocalRun.command })
                : t('agent.webhookRunner')}
            </span>
          </div>
          {latestLocalRun?.status ? (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <span className="text-muted-foreground">{t('agent.runnerStatus')}</span>
              <span className="font-medium">{formatRunnerStatus(latestLocalRun.status)}</span>
            </div>
          ) : null}
          {latestLocalRun?.exitCode !== null && latestLocalRun?.exitCode !== undefined ? (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <span className="text-muted-foreground">{t('agent.exitCode')}</span>
              <span className="font-mono text-[11px]">{latestLocalRun.exitCode}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2">
        <label className="grid gap-1.5">
          <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-normal">
            {t('agent.provider')}
          </span>
          <Select
            value={selectedProvider}
            onValueChange={(value) => setSelectedProvider(value as AgentProviderKind)}
          >
            <SelectTrigger className="h-9">
              <SelectValue aria-label={t('agent.provider')} />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {t(`agent.providers.${provider}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <Textarea
          value={promptOverride}
          onChange={(event) => setPromptOverride(event.target.value)}
          placeholder={t('agent.promptPlaceholder')}
          className="min-h-20 resize-none text-xs"
        />

        <Button
          type="button"
          onClick={onDispatch}
          disabled={isDispatching}
          size="sm"
          className="h-9 w-full justify-center gap-2 rounded-sm"
        >
          {isDispatching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {isDispatching ? t('agent.dispatching') : t('agent.dispatch')}
        </Button>
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      <div className="border-border/50 space-y-2 border-t pt-3">
        <div className="text-muted-foreground flex items-center justify-between text-[11px]">
          <span>{t('agent.latestSessions')}</span>
          {sessionsQuery.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        </div>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t('agent.noSessions')}</p>
        ) : (
          <ul className="space-y-1.5">
            {sessions.slice(0, 4).map((session) => {
              const localRun = readLocalRun(session.payload);
              const Icon = stateIcon(session.state);
              return (
                <li
                  key={session.id}
                  className="bg-background/70 border-border/50 flex flex-col gap-2 rounded-md border px-2 py-2 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <TerminalSquare className="text-muted-foreground h-3 w-3" />
                      <span className="truncate text-xs font-medium">
                        {t(`agent.providers.${session.provider}`)}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-sm border px-1 py-0.5 text-[10px]',
                          statusTone(session.state)
                        )}
                      >
                        <Icon
                          className={cn('h-3 w-3', session.state === 'active' && 'animate-spin')}
                        />
                        {t(`agent.states.${session.state}`)}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate text-[11px]">
                      {localRun?.command
                        ? t('agent.localRunner', { command: localRun.command })
                        : t('agent.webhookRunner')}
                      {localRun?.status
                        ? t('agent.runnerStatusSuffix', {
                            status: formatRunnerStatus(localRun.status),
                          })
                        : ''}
                    </p>
                  </div>
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-[10px]">
                    <Clock3 className="h-3 w-3" />
                    {format.dateTime(new Date(session.updatedAt), {
                      hour: 'numeric',
                      minute: 'numeric',
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
