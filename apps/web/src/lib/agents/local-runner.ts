import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync } from 'node:fs';
import path from 'node:path';
import { agentSessions, db, eq } from '@tasknebula/db';
import { emitAgentLog, emitAgentStatus } from '@/lib/websocket/server';
import { type AgentProviderKind, type AgentSessionRequest } from '@/lib/agents/sessions';

type LocalRunnerProvider = Extract<AgentProviderKind, 'claude' | 'codex'>;

type LocalAgentSessionState = 'active' | 'complete' | 'error';

export interface LocalAgentRunnerConfig {
  provider: LocalRunnerProvider;
  command: string;
  cwd: string;
  model: string | null;
  timeoutMs: number;
  maxTurns: number | null;
  codexSandbox: 'read-only' | 'workspace-write' | 'danger-full-access';
  claudePermissionMode:
    | 'default'
    | 'acceptEdits'
    | 'plan'
    | 'auto'
    | 'dontAsk'
    | 'bypassPermissions';
  extraArgs: string[];
  source: 'provider' | 'env';
}

export interface LocalAgentRunnerStatus {
  provider: LocalRunnerProvider;
  configured: boolean;
  enabledByProvider: boolean;
  enabledByEnv: boolean;
  command: string;
  cwd: string;
  model: string | null;
  timeoutSeconds: number;
  mode: string;
  reasonCode: 'disabled' | 'cwd_missing' | 'command_missing' | null;
  reasonDetail: string | null;
}

export interface LocalAgentDispatchContext {
  sessionId: string;
  provider: LocalRunnerProvider;
  issue: AgentSessionRequest['issue'] & {
    reporterId: string;
  };
  actorUserId: string | null;
  promptOverride: string | null;
  appBaseUrl: string;
}

const LOCAL_ENDPOINT_PREFIX = 'local://';
const DEFAULT_TIMEOUT_SECONDS = 60 * 60;
const MIN_TIMEOUT_SECONDS = 60;
const MAX_TIMEOUT_SECONDS = 12 * 60 * 60;
const MAX_STORED_LOG_LINES = 160;

function readBoolean(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readIntegerEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseExtraArgs(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
}

function normalizeProvider(value: AgentProviderKind): LocalRunnerProvider | null {
  return value === 'claude' || value === 'codex' ? value : null;
}

function providerEnvPrefix(provider: LocalRunnerProvider): 'CLAUDE' | 'CODEX' {
  return provider === 'claude' ? 'CLAUDE' : 'CODEX';
}

function commandFor(provider: LocalRunnerProvider): string {
  const prefix = providerEnvPrefix(provider);
  return process.env[`TASKNEBULA_LOCAL_${prefix}_COMMAND`] || provider;
}

function cwdFor(provider: LocalRunnerProvider): string {
  const prefix = providerEnvPrefix(provider);
  return path.resolve(
    process.env[`TASKNEBULA_LOCAL_${prefix}_CWD`] ||
      process.env.TASKNEBULA_LOCAL_AGENT_CWD ||
      process.env.TASKNEBULA_REPO_ROOT ||
      process.cwd()
  );
}

function canExecute(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command: string, cwd: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;

  if (path.isAbsolute(trimmed) || trimmed.includes('/') || trimmed.includes('\\')) {
    const target = path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
    return canExecute(target);
  }

  const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const executableExtensions =
    process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];

  return pathEntries.some((entry) =>
    executableExtensions.some((extension) => canExecute(path.join(entry, `${trimmed}${extension}`)))
  );
}

export function isLocalAgentEndpoint(endpointUrl: string | null | undefined): boolean {
  return Boolean(endpointUrl?.startsWith(LOCAL_ENDPOINT_PREFIX));
}

export function getLocalAgentRunnerStatus(
  providerValue: AgentProviderKind,
  endpointUrl?: string | null,
  enabled = false
): LocalAgentRunnerStatus | null {
  const provider = normalizeProvider(providerValue);
  if (!provider) return null;

  const prefix = providerEnvPrefix(provider);
  const enabledByProvider = enabled && isLocalAgentEndpoint(endpointUrl);
  const enabledByEnv =
    readBoolean(process.env.TASKNEBULA_LOCAL_AGENT_RUNNER_ENABLED) ||
    readBoolean(process.env[`TASKNEBULA_LOCAL_${prefix}_ENABLED`]);
  const command = commandFor(provider);
  const cwd = cwdFor(provider);
  const timeoutSeconds = clamp(
    readIntegerEnv(`TASKNEBULA_LOCAL_${prefix}_TIMEOUT_SECONDS`, DEFAULT_TIMEOUT_SECONDS),
    MIN_TIMEOUT_SECONDS,
    MAX_TIMEOUT_SECONDS
  );
  const mode =
    provider === 'codex'
      ? process.env.TASKNEBULA_LOCAL_CODEX_SANDBOX || 'workspace-write'
      : process.env.TASKNEBULA_LOCAL_CLAUDE_PERMISSION_MODE || 'auto';

  let reasonCode: LocalAgentRunnerStatus['reasonCode'] = null;
  let reasonDetail: string | null = null;
  if (!enabledByProvider && !enabledByEnv) {
    reasonCode = 'disabled';
  } else if (!existsSync(cwd)) {
    reasonCode = 'cwd_missing';
    reasonDetail = cwd;
  } else if (!commandExists(command, cwd)) {
    reasonCode = 'command_missing';
    reasonDetail = command;
  }

  return {
    provider,
    configured: !reasonCode,
    enabledByProvider,
    enabledByEnv,
    command,
    cwd,
    model: process.env[`TASKNEBULA_LOCAL_${prefix}_MODEL`] || null,
    timeoutSeconds,
    mode,
    reasonCode,
    reasonDetail,
  };
}

export function resolveLocalAgentRunner(
  providerValue: AgentProviderKind,
  endpointUrl?: string | null,
  enabled = false
): LocalAgentRunnerConfig | null {
  const status = getLocalAgentRunnerStatus(providerValue, endpointUrl, enabled);
  if (!status?.configured) return null;

  const provider = status.provider;
  const prefix = providerEnvPrefix(provider);
  const timeoutSeconds = status.timeoutSeconds;

  return {
    provider,
    command: status.command,
    cwd: status.cwd,
    model: status.model,
    timeoutMs: timeoutSeconds * 1000,
    maxTurns:
      provider === 'claude'
        ? clamp(readIntegerEnv('TASKNEBULA_LOCAL_CLAUDE_MAX_TURNS', 20), 1, 100)
        : null,
    codexSandbox:
      status.mode === 'read-only' || status.mode === 'danger-full-access'
        ? status.mode
        : 'workspace-write',
    claudePermissionMode:
      status.mode === 'default' ||
      status.mode === 'acceptEdits' ||
      status.mode === 'plan' ||
      status.mode === 'dontAsk' ||
      status.mode === 'bypassPermissions'
        ? status.mode
        : 'auto',
    extraArgs: parseExtraArgs(process.env[`TASKNEBULA_LOCAL_${prefix}_ARGS_JSON`]),
    source: status.enabledByProvider ? 'provider' : 'env',
  };
}

export function buildLocalAgentPrompt(context: LocalAgentDispatchContext): string {
  const labels = Array.isArray(context.issue.labels)
    ? context.issue.labels.join(', ')
    : String(context.issue.labels ?? '');

  return [
    'TaskNebula agent handoff',
    '',
    `Issue: ${context.issue.key} - ${context.issue.title}`,
    `Issue URL: ${context.issue.url}`,
    `Project ID: ${context.issue.projectId}`,
    `Organization ID: ${context.issue.organizationId}`,
    `Priority: ${context.issue.priority}`,
    labels ? `Labels: ${labels}` : null,
    '',
    'Description:',
    context.issue.description || '(empty)',
    '',
    context.promptOverride ? `Admin instructions:\n${context.promptOverride}` : null,
    '',
    'Execution policy:',
    '- Work only inside the configured repository/workspace.',
    '- Do not push commits or publish external changes unless repository instructions explicitly require it.',
    '- Prefer small, verifiable changes and run the relevant local checks.',
    '- End with a concise summary, changed files, verification commands, and any remaining risks.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

function commandArgs(config: LocalAgentRunnerConfig): { args: string[]; stdinPrompt: boolean } {
  if (config.provider === 'codex') {
    const args = [
      'exec',
      '--json',
      '--sandbox',
      config.codexSandbox,
      '--cd',
      config.cwd,
      ...config.extraArgs,
    ];
    if (config.model) args.push('--model', config.model);
    args.push('-');
    return { args, stdinPrompt: true };
  }

  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    config.claudePermissionMode,
    '--exclude-dynamic-system-prompt-sections',
    ...config.extraArgs,
  ];
  if (config.model) args.push('--model', config.model);
  if (config.maxTurns) args.push('--max-turns', String(config.maxTurns));
  args.push(
    'Read the TaskNebula issue handoff from stdin and complete the requested engineering task.'
  );
  return { args, stdinPrompt: true };
}

async function loadPayload(sessionId: string): Promise<Record<string, unknown>> {
  const [session] = await db
    .select({ payload: agentSessions.payload })
    .from(agentSessions)
    .where(eq(agentSessions.id, sessionId))
    .limit(1);
  return typeof session?.payload === 'object' && session.payload !== null
    ? (session.payload as Record<string, unknown>)
    : {};
}

async function updateLocalRunPayload(
  sessionId: string,
  updates: Record<string, unknown>,
  state?: LocalAgentSessionState
) {
  const payload = await loadPayload(sessionId);
  const localRun =
    typeof payload.localRun === 'object' && payload.localRun !== null
      ? (payload.localRun as Record<string, unknown>)
      : {};

  const updateValues: Partial<typeof agentSessions.$inferInsert> = {
    payload: {
      ...payload,
      localRun: {
        ...localRun,
        ...updates,
      },
    },
    updatedAt: new Date(),
  };
  if (state) {
    updateValues.state = state;
    updateValues.finishedAt = state === 'complete' || state === 'error' ? new Date() : null;
  }

  await db.update(agentSessions).set(updateValues).where(eq(agentSessions.id, sessionId));
}

async function appendLogLine(params: {
  sessionId: string;
  projectId: string;
  logIndex: number;
  type: 'stdout' | 'stderr' | 'system';
  content: string;
}) {
  const timestamp = new Date();
  emitAgentLog(params.sessionId, params.projectId, {
    logIndex: params.logIndex,
    type: params.type,
    content: params.content,
    timestamp,
  });

  const payload = await loadPayload(params.sessionId);
  const localRun =
    typeof payload.localRun === 'object' && payload.localRun !== null
      ? (payload.localRun as Record<string, unknown>)
      : {};
  const logs = Array.isArray(localRun.logs) ? localRun.logs : [];

  await db
    .update(agentSessions)
    .set({
      payload: {
        ...payload,
        localRun: {
          ...localRun,
          logs: [
            ...logs,
            {
              index: params.logIndex,
              type: params.type,
              content: params.content,
              timestamp: timestamp.toISOString(),
            },
          ].slice(-MAX_STORED_LOG_LINES),
        },
      },
      updatedAt: timestamp,
    })
    .where(eq(agentSessions.id, params.sessionId));
}

function splitLines(buffer: string, chunk: Buffer): { lines: string[]; rest: string } {
  const text = buffer + chunk.toString('utf8');
  const parts = text.split(/\r?\n/);
  const rest = parts.pop() ?? '';
  return { lines: parts.filter((line) => line.length > 0), rest };
}

export async function runLocalAgentSession(
  config: LocalAgentRunnerConfig,
  context: LocalAgentDispatchContext
): Promise<void> {
  let logIndex = 0;
  let stdoutRest = '';
  let stderrRest = '';
  let timedOut = false;

  const prompt = buildLocalAgentPrompt(context);
  const { args, stdinPrompt } = commandArgs(config);

  await updateLocalRunPayload(
    context.sessionId,
    {
      provider: config.provider,
      command: config.command,
      args,
      cwd: config.cwd,
      source: config.source,
      startedAt: new Date().toISOString(),
      timeoutMs: config.timeoutMs,
      status: 'running',
    },
    'active'
  );
  emitAgentStatus(context.sessionId, context.issue.projectId, {
    status: 'running',
    progress: 5,
  });
  await appendLogLine({
    sessionId: context.sessionId,
    projectId: context.issue.projectId,
    logIndex: logIndex++,
    type: 'system',
    content: `${config.provider} local runner started in ${config.cwd}`,
  });

  const child = spawn(config.command, args, {
    cwd: config.cwd,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
    }, 5000).unref();
  }, config.timeoutMs);
  timeout.unref();

  child.stdout.on('data', (chunk: Buffer) => {
    const next = splitLines(stdoutRest, chunk);
    stdoutRest = next.rest;
    next.lines.forEach((line) => {
      void appendLogLine({
        sessionId: context.sessionId,
        projectId: context.issue.projectId,
        logIndex: logIndex++,
        type: 'stdout',
        content: line,
      });
    });
  });

  child.stderr.on('data', (chunk: Buffer) => {
    const next = splitLines(stderrRest, chunk);
    stderrRest = next.rest;
    next.lines.forEach((line) => {
      void appendLogLine({
        sessionId: context.sessionId,
        projectId: context.issue.projectId,
        logIndex: logIndex++,
        type: 'stderr',
        content: line,
      });
    });
  });

  child.on('error', async (error) => {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : String(error);
    await updateLocalRunPayload(
      context.sessionId,
      {
        status: 'failed',
        error: message,
        finishedAt: new Date().toISOString(),
      },
      'error'
    );
    emitAgentStatus(context.sessionId, context.issue.projectId, {
      status: 'failed',
      progress: 100,
      error: message,
    });
  });

  child.on('close', async (code, signal) => {
    clearTimeout(timeout);
    if (stdoutRest) {
      await appendLogLine({
        sessionId: context.sessionId,
        projectId: context.issue.projectId,
        logIndex: logIndex++,
        type: 'stdout',
        content: stdoutRest,
      });
    }
    if (stderrRest) {
      await appendLogLine({
        sessionId: context.sessionId,
        projectId: context.issue.projectId,
        logIndex: logIndex++,
        type: 'stderr',
        content: stderrRest,
      });
    }

    const succeeded = code === 0 && !timedOut;
    const message = succeeded
      ? `${config.provider} local runner completed.`
      : timedOut
        ? `${config.provider} local runner timed out after ${Math.round(config.timeoutMs / 1000)}s.`
        : `${config.provider} local runner exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}.`;

    await updateLocalRunPayload(
      context.sessionId,
      {
        status: succeeded ? 'completed' : 'failed',
        exitCode: code,
        signal,
        error: succeeded ? null : message,
        finishedAt: new Date().toISOString(),
      },
      succeeded ? 'complete' : 'error'
    );
    emitAgentStatus(context.sessionId, context.issue.projectId, {
      status: succeeded ? 'completed' : 'failed',
      progress: 100,
      error: succeeded ? undefined : message,
    });
  });

  if (stdinPrompt) {
    child.stdin.end(prompt);
  }
}
