import type { AgentCapabilityKey, AgentProvider } from './config';

type Translate = (key: string, values?: Record<string, string | number>) => string;

type ProviderStatus = {
  ready: boolean;
  configured: boolean;
  source: 'workspace' | 'platform' | 'server_env' | null;
  label: string | null;
};

type ConfigIssue = {
  code: string;
  scope: 'system' | 'workspace' | 'project' | 'provider';
  title?: string;
  detail?: string;
  resolution?: string;
};

const PROVIDER_ENV_KEYS: Partial<Record<AgentProvider, string>> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  azure: 'AZURE_OPENAI_API_KEY',
};

export function agentProviderLabel(provider: AgentProvider | string) {
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'azure') return 'Azure OpenAI';
  if (provider === 'native') return 'TaskNebula';
  if (provider === 'custom') return 'Custom';
  return provider;
}

function providerEnvVar(provider: AgentProvider | string) {
  return PROVIDER_ENV_KEYS[provider as AgentProvider] || `${provider.toUpperCase()}_API_KEY`;
}

function isNativePlaceholderModel(model?: string) {
  return !model?.trim() || model.startsWith('tasknebula-');
}

function providerValues(provider: AgentProvider | string) {
  return {
    provider: agentProviderLabel(provider),
    envVar: providerEnvVar(provider),
    model: 'gpt-5.4',
  };
}

export function formatAgentProviderStatus(
  t: Translate,
  provider: AgentProvider,
  model: string | undefined,
  status: ProviderStatus
) {
  const values = providerValues(provider);

  if (provider === 'native') {
    return t('agentShared.providerStatus.nativeReady');
  }

  if (provider === 'custom') {
    return t('agentShared.providerStatus.customUnavailable');
  }

  if (provider === 'anthropic' || provider === 'azure') {
    return t('agentShared.providerStatus.adapterUnavailable', values);
  }

  if (provider === 'openai' && isNativePlaceholderModel(model)) {
    return t('agentShared.providerStatus.openaiModelInvalid', values);
  }

  if (!status.configured) {
    return t('agentShared.providerStatus.missingCredentialWithEnv', values);
  }

  if (status.source === 'workspace') {
    return t('agentShared.providerStatus.readyWorkspace', values);
  }

  if (status.source === 'platform') {
    return t('agentShared.providerStatus.readyPlatform', values);
  }

  if (status.source === 'server_env') {
    return t('agentShared.providerStatus.readyServerEnv', values);
  }

  return t('agentShared.providerStatus.ready', values);
}

export function formatAgentCredentialLabel(
  t: Translate,
  provider: AgentProvider,
  status: ProviderStatus,
  fallback: string
) {
  if (!status.configured) {
    return fallback;
  }

  if (provider === 'native') {
    return t('agentShared.credential.builtInPlanner');
  }

  if (status.source === 'platform') {
    const preview = status.label?.split(' · ').pop() || fallback;
    return t('agentShared.credential.platformDefault', { preview });
  }

  if (status.source === 'server_env') {
    return t('agentShared.credential.serverEnv', { envVar: providerEnvVar(provider) });
  }

  return status.label || fallback;
}

export function formatAgentConfigIssueField(
  t: Translate,
  issue: ConfigIssue,
  context: 'project' | 'workspace',
  field: 'title' | 'detail' | 'resolution',
  provider: AgentProvider | string = 'openai'
) {
  const section = issue.scope === 'provider' || issue.scope === 'system' ? issue.scope : context;
  const key =
    field === 'title'
      ? `agentShared.configIssues.titles.${issue.code}`
      : `agentShared.configIssues.${section}.${field}`;

  try {
    return t(key, providerValues(provider));
  } catch {
    return t(`agentShared.configIssues.unknown.${field}`);
  }
}

export function formatAgentServiceLabel(t: Translate, key: string) {
  return t(`agentShared.services.labels.${key}`);
}

export function formatAgentRunStatus(t: Translate, status: string) {
  if (status === 'running' || status === 'completed' || status === 'failed') {
    return t(`agentShared.runStatuses.${status}`);
  }

  return t('agentShared.runStatuses.unknown', { status });
}

const RUN_KIND_SUMMARY_KEYS: Record<string, string> = {
  'Project health scan': 'project_tracking',
  'Backlog triage': 'backlog_triage',
  'Sprint planning preview': 'sprint_planning',
  'Bulk sprint creation': 'bulk_sprint_creation',
  'Agent run': 'unknown',
};

function formatAgentRunSummaryKind(t: Translate, value: string) {
  const key = RUN_KIND_SUMMARY_KEYS[value];
  if (!key) {
    return value;
  }

  return t(`agentShared.runMessages.kinds.${key}`, { kind: value });
}

function formatProviderName(provider: string) {
  return agentProviderLabel(provider);
}

function matchAgentRunMessage(text: string, matcher: RegExp): RegExpMatchArray | null {
  return text.match(matcher);
}

export function formatAgentRunDisplayText(t: Translate, text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  const normalizedText = text.trim();
  const exactKeys: Record<string, string> = {
    'No active sprint is running in this project.': 'noActiveSprint',
    'Backlog already matches the current triage heuristics.': 'backlogAlreadyTriaged',
    'Backlog triage found no changes to apply.': 'backlogNoChanges',
    'Write actions are disabled, returning a preview only.': 'writeActionsPreviewOnly',
    'No eligible backlog issues were found for sprint planning.': 'noEligibleBacklog',
    'Bulk sprint creation is in preview mode only.': 'bulkPreviewOnly',
    'Requesting a structured agent plan from the configured LLM provider.':
      'requestingProviderPlan',
    'Structured provider plan generated successfully.': 'providerPlanGenerated',
    'Agent run failed': 'agentRunFailed',
    'Project not found': 'projectNotFound',
    'Unsupported agent run kind': 'unsupportedRunKind',
    'Failed to create sprint': 'sprintCreateFailed',
  };
  const exactKey = exactKeys[normalizedText];

  if (exactKey) {
    return t(`agentShared.runMessages.${exactKey}`);
  }

  const startedMatch = matchAgentRunMessage(
    normalizedText,
    /^(.+) started for (.+?)( in preview mode)?\.$/
  );
  if (startedMatch) {
    return t(
      startedMatch[3]
        ? 'agentShared.runMessages.startedPreview'
        : 'agentShared.runMessages.started',
      {
        kind: formatAgentRunSummaryKind(t, startedMatch[1] ?? ''),
        project: startedMatch[2] ?? '',
      }
    );
  }

  const providerProfileMatch = matchAgentRunMessage(
    normalizedText,
    /^Using ([a-z_]+) provider with model (.+?) via profile (.+)\.$/
  );
  if (providerProfileMatch) {
    return t('agentShared.runMessages.usingProviderProfile', {
      provider: formatProviderName(providerProfileMatch[1] ?? ''),
      model: providerProfileMatch[2] ?? '',
      profile: providerProfileMatch[3] ?? '',
    });
  }

  const providerMatch = matchAgentRunMessage(
    normalizedText,
    /^Using ([a-z_]+) provider with model (.+?)\.$/
  );
  if (providerMatch) {
    return t('agentShared.runMessages.usingProvider', {
      provider: formatProviderName(providerMatch[1] ?? ''),
      model: providerMatch[2] ?? '',
    });
  }

  const scannedMatch = matchAgentRunMessage(normalizedText, /^Scanned (\d+) issues across (.+)\.$/);
  if (scannedMatch) {
    return t('agentShared.runMessages.scannedIssues', {
      count: Number(scannedMatch[1] ?? 0),
      project: scannedMatch[2] ?? '',
    });
  }

  const activeSprintMatch = matchAgentRunMessage(
    normalizedText,
    /^Active sprint detected: (.+)\.$/
  );
  if (activeSprintMatch) {
    return t('agentShared.runMessages.activeSprintDetected', {
      sprint: activeSprintMatch[1] ?? '',
    });
  }

  const trackingActiveMatch = matchAgentRunMessage(
    normalizedText,
    /^(.+) has (\d+) open issues and (\d+) blockers in flight\.$/
  );
  if (trackingActiveMatch) {
    return t('agentShared.runMessages.projectTrackingActiveSummary', {
      project: trackingActiveMatch[1] ?? '',
      open: Number(trackingActiveMatch[2] ?? 0),
      blocked: Number(trackingActiveMatch[3] ?? 0),
    });
  }

  const trackingNoSprintMatch = matchAgentRunMessage(
    normalizedText,
    /^(.+) has (\d+) open issues with no active sprint\.$/
  );
  if (trackingNoSprintMatch) {
    return t('agentShared.runMessages.projectTrackingNoSprintSummary', {
      project: trackingNoSprintMatch[1] ?? '',
      open: Number(trackingNoSprintMatch[2] ?? 0),
    });
  }

  const foundBacklogMatch = matchAgentRunMessage(
    normalizedText,
    /^Found (\d+) backlog issues to inspect\.$/
  );
  if (foundBacklogMatch) {
    return t('agentShared.runMessages.foundBacklogIssues', {
      count: Number(foundBacklogMatch[1] ?? 0),
    });
  }

  const rerankMatch = matchAgentRunMessage(
    normalizedText,
    /^(\d+) issue will be re-ranked by the triage engine\.$/
  );
  if (rerankMatch) {
    return t('agentShared.runMessages.triageRerank', {
      count: Number(rerankMatch[1] ?? 0),
    });
  }

  const preparedTriageMatch = matchAgentRunMessage(
    normalizedText,
    /^Prepared (\d+) backlog triage updates\.$/
  );
  if (preparedTriageMatch) {
    return t('agentShared.runMessages.preparedTriageUpdates', {
      count: Number(preparedTriageMatch[1] ?? 0),
    });
  }

  const appliedTriageMatch = matchAgentRunMessage(
    normalizedText,
    /^Applied (\d+) triage updates to backlog issues\.$/
  );
  if (appliedTriageMatch) {
    return t('agentShared.runMessages.appliedTriageUpdates', {
      count: Number(appliedTriageMatch[1] ?? 0),
    });
  }

  const updatedBacklogMatch = matchAgentRunMessage(
    normalizedText,
    /^Updated (\d+) backlog issues with fresh priority and labels\.$/
  );
  if (updatedBacklogMatch) {
    return t('agentShared.runMessages.updatedBacklogIssues', {
      count: Number(updatedBacklogMatch[1] ?? 0),
    });
  }

  const planningMatch = matchAgentRunMessage(
    normalizedText,
    /^Planning against (\d+) backlog issues\.$/
  );
  if (planningMatch) {
    return t('agentShared.runMessages.planningBacklogIssues', {
      count: Number(planningMatch[1] ?? 0),
    });
  }

  const preparedSprintPlanMatch = matchAgentRunMessage(
    normalizedText,
    /^Prepared (\d+) sprint plan blocks? for (.+)\.$/
  );
  if (preparedSprintPlanMatch) {
    return t('agentShared.runMessages.preparedSprintPlan', {
      count: Number(preparedSprintPlanMatch[1] ?? 0),
      project: preparedSprintPlanMatch[2] ?? '',
    });
  }

  const createdSprintLogMatch = matchAgentRunMessage(
    normalizedText,
    /^Created (\d+) planned sprints? from backlog\.$/
  );
  if (createdSprintLogMatch) {
    return t('agentShared.runMessages.createdSprintLog', {
      count: Number(createdSprintLogMatch[1] ?? 0),
    });
  }

  const createdSprintSummaryMatch = matchAgentRunMessage(
    normalizedText,
    /^Created (\d+) planned sprints for (.+)\.$/
  );
  if (createdSprintSummaryMatch) {
    return t('agentShared.runMessages.createdSprintSummary', {
      count: Number(createdSprintSummaryMatch[1] ?? 0),
      project: createdSprintSummaryMatch[2] ?? '',
    });
  }

  return text;
}

export function formatAgentCapabilityLabel(t: Translate, key: AgentCapabilityKey | string) {
  return t(`agentShared.capabilities.${key}.label`);
}

export function formatAgentCapabilityDescription(t: Translate, key: AgentCapabilityKey | string) {
  return t(`agentShared.capabilities.${key}.description`);
}

export function formatAgentCapabilityWrites(t: Translate, key: AgentCapabilityKey | string) {
  if (key === 'backlog_triage') {
    return [
      t('agentShared.capabilities.backlog_triage.writes.priority'),
      t('agentShared.capabilities.backlog_triage.writes.labels'),
    ];
  }

  if (key === 'bulk_sprint_creation') {
    return [
      t('agentShared.capabilities.bulk_sprint_creation.writes.sprints'),
      t('agentShared.capabilities.bulk_sprint_creation.writes.assignments'),
    ];
  }

  return [];
}
