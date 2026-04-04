export const AGENT_RUN_KINDS = [
  'project_tracking',
  'backlog_triage',
  'sprint_planning',
  'bulk_sprint_creation',
] as const;

export type AgentRunKind = (typeof AGENT_RUN_KINDS)[number];

export const AGENT_CAPABILITY_KEYS = [
  'project_tracking',
  'backlog_triage',
  'sprint_planning',
  'bulk_sprint_creation',
] as const;

export type AgentCapabilityKey = (typeof AGENT_CAPABILITY_KEYS)[number];

export const AGENT_EXECUTION_MODES = ['manual', 'assistive', 'auto'] as const;
export type AgentExecutionMode = (typeof AGENT_EXECUTION_MODES)[number];

export const AGENT_PROVIDERS = ['native', 'openai', 'anthropic', 'azure', 'custom'] as const;
export type AgentProvider = (typeof AGENT_PROVIDERS)[number];

export const AGENT_PROVIDER_DEFAULT_MODELS: Record<AgentProvider, string> = {
  native: 'tasknebula-planner-v1',
  openai: 'gpt-5.4',
  anthropic: '',
  azure: 'gpt-5.4',
  custom: '',
};

export type AgentCapabilityMap = Record<AgentCapabilityKey, boolean>;

export type WorkspaceAgentSettings = {
  enabled: boolean;
  modelConfigId?: string | null;
  provider: AgentProvider;
  model: string;
  executionMode: AgentExecutionMode;
  allowWriteActions: boolean;
  requireApprovalForWrites: boolean;
  dailyRunLimit: number;
  capabilities: AgentCapabilityMap;
};

export type ProjectAgentSettings = {
  enabled: boolean;
  inheritWorkspaceDefaults: boolean;
  executionMode: AgentExecutionMode;
  allowWriteActions: boolean;
  sprintBatchSize: number;
  sprintLengthDays: number;
  issueCapacityPerSprint: number;
  autoAssignToPlannedSprints: boolean;
  capabilities: AgentCapabilityMap;
};

export type EffectiveProjectAgentSettings = ProjectAgentSettings & {
  modelConfigId?: string | null;
  provider: AgentProvider;
  model: string;
  requireApprovalForWrites: boolean;
  dailyRunLimit: number;
};

export type SystemAgentControlSettings = {
  globalEnabled: boolean;
  allowWriteActions: boolean;
  requireSupervisionForAutoMode: boolean;
  maxConcurrentRuns: number;
};

export type AgentProviderReadiness = {
  ready: boolean;
  summary: string;
  configured: boolean;
  source: 'workspace' | 'server_env' | null;
  label: string | null;
  updatedAt: string | null;
};

export type AgentConfigIssue = {
  code:
    | 'global_paused'
    | 'workspace_disabled'
    | 'project_disabled'
    | 'provider_missing_credential'
    | 'provider_model_invalid'
    | 'provider_adapter_unavailable'
    | 'writes_preview_only'
    | 'write_approval_required'
    | 'auto_mode_supervised';
  scope: 'system' | 'workspace' | 'project' | 'provider';
  severity: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  resolution: string;
  blocksRuns: boolean;
};

export type ProjectAgentRunAvailability = {
  canRun: boolean;
  reason: string | null;
  blockingIssue: AgentConfigIssue | null;
  issues: AgentConfigIssue[];
};

export const AGENT_CAPABILITY_DETAILS: Record<
  AgentCapabilityKey,
  { label: string; description: string; writes: string[] }
> = {
  project_tracking: {
    label: 'Project tracking',
    description: 'Scans delivery health, overdue work, and sprint readiness.',
    writes: [],
  },
  backlog_triage: {
    label: 'Backlog triage',
    description: 'Re-prioritizes backlog issues and prepares work for planning.',
    writes: ['Issue priority', 'Issue labels'],
  },
  sprint_planning: {
    label: 'Sprint planning',
    description: 'Builds a proposed sprint plan without changing project data.',
    writes: [],
  },
  bulk_sprint_creation: {
    label: 'Bulk sprint creation',
    description: 'Creates planned sprints in sequence and can pre-assign backlog work.',
    writes: ['Sprints', 'Issue sprint assignments'],
  },
};

export const DEFAULT_WORKSPACE_AGENT_SETTINGS: WorkspaceAgentSettings = {
  enabled: false,
  modelConfigId: null,
  provider: 'native',
  model: AGENT_PROVIDER_DEFAULT_MODELS.native,
  executionMode: 'assistive',
  allowWriteActions: false,
  requireApprovalForWrites: true,
  dailyRunLimit: 20,
  capabilities: {
    project_tracking: true,
    backlog_triage: true,
    sprint_planning: true,
    bulk_sprint_creation: true,
  },
};

export const DEFAULT_PROJECT_AGENT_SETTINGS: ProjectAgentSettings = {
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

export const DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS: SystemAgentControlSettings = {
  globalEnabled: true,
  allowWriteActions: true,
  requireSupervisionForAutoMode: true,
  maxConcurrentRuns: 6,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asBool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(value), min), max);
}

function normalizeCapabilities(input: unknown, fallback: AgentCapabilityMap): AgentCapabilityMap {
  const source = isObject(input) ? input : {};

  return AGENT_CAPABILITY_KEYS.reduce((accumulator, key) => {
    accumulator[key] = asBool(source[key], fallback[key]);
    return accumulator;
  }, {} as AgentCapabilityMap);
}

export function normalizeWorkspaceAgentSettings(input: unknown): WorkspaceAgentSettings {
  const source = isObject(input) ? input : {};

  return {
    enabled: asBool(source.enabled, DEFAULT_WORKSPACE_AGENT_SETTINGS.enabled),
    modelConfigId: typeof source.modelConfigId === 'string' && source.modelConfigId.trim()
      ? source.modelConfigId.trim()
      : DEFAULT_WORKSPACE_AGENT_SETTINGS.modelConfigId,
    provider: (AGENT_PROVIDERS.includes(source.provider as AgentProvider)
      ? source.provider
      : DEFAULT_WORKSPACE_AGENT_SETTINGS.provider) as AgentProvider,
    model: asString(source.model, DEFAULT_WORKSPACE_AGENT_SETTINGS.model),
    executionMode: (AGENT_EXECUTION_MODES.includes(source.executionMode as AgentExecutionMode)
      ? source.executionMode
      : DEFAULT_WORKSPACE_AGENT_SETTINGS.executionMode) as AgentExecutionMode,
    allowWriteActions: asBool(source.allowWriteActions, DEFAULT_WORKSPACE_AGENT_SETTINGS.allowWriteActions),
    requireApprovalForWrites: asBool(
      source.requireApprovalForWrites,
      DEFAULT_WORKSPACE_AGENT_SETTINGS.requireApprovalForWrites
    ),
    dailyRunLimit: asNumber(source.dailyRunLimit, DEFAULT_WORKSPACE_AGENT_SETTINGS.dailyRunLimit, 1, 500),
    capabilities: normalizeCapabilities(source.capabilities, DEFAULT_WORKSPACE_AGENT_SETTINGS.capabilities),
  };
}

export function normalizeProjectAgentSettings(input: unknown): ProjectAgentSettings {
  const source = isObject(input) ? input : {};

  return {
    enabled: asBool(source.enabled, DEFAULT_PROJECT_AGENT_SETTINGS.enabled),
    inheritWorkspaceDefaults: asBool(
      source.inheritWorkspaceDefaults,
      DEFAULT_PROJECT_AGENT_SETTINGS.inheritWorkspaceDefaults
    ),
    executionMode: (AGENT_EXECUTION_MODES.includes(source.executionMode as AgentExecutionMode)
      ? source.executionMode
      : DEFAULT_PROJECT_AGENT_SETTINGS.executionMode) as AgentExecutionMode,
    allowWriteActions: asBool(source.allowWriteActions, DEFAULT_PROJECT_AGENT_SETTINGS.allowWriteActions),
    sprintBatchSize: asNumber(source.sprintBatchSize, DEFAULT_PROJECT_AGENT_SETTINGS.sprintBatchSize, 1, 6),
    sprintLengthDays: asNumber(source.sprintLengthDays, DEFAULT_PROJECT_AGENT_SETTINGS.sprintLengthDays, 7, 30),
    issueCapacityPerSprint: asNumber(
      source.issueCapacityPerSprint,
      DEFAULT_PROJECT_AGENT_SETTINGS.issueCapacityPerSprint,
      3,
      50
    ),
    autoAssignToPlannedSprints: asBool(
      source.autoAssignToPlannedSprints,
      DEFAULT_PROJECT_AGENT_SETTINGS.autoAssignToPlannedSprints
    ),
    capabilities: normalizeCapabilities(source.capabilities, DEFAULT_PROJECT_AGENT_SETTINGS.capabilities),
  };
}

export function normalizeSystemAgentControlSettings(input: unknown): SystemAgentControlSettings {
  const source = isObject(input) ? input : {};

  return {
    globalEnabled: asBool(source.globalEnabled, DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS.globalEnabled),
    allowWriteActions: asBool(source.allowWriteActions, DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS.allowWriteActions),
    requireSupervisionForAutoMode: asBool(
      source.requireSupervisionForAutoMode,
      DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS.requireSupervisionForAutoMode
    ),
    maxConcurrentRuns: asNumber(
      source.maxConcurrentRuns,
      DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS.maxConcurrentRuns,
      1,
      50
    ),
  };
}

export function resolveEffectiveProjectAgentSettings(
  workspace: WorkspaceAgentSettings,
  project: ProjectAgentSettings,
  systemControl: SystemAgentControlSettings = DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS
): EffectiveProjectAgentSettings {
  const capabilities = AGENT_CAPABILITY_KEYS.reduce((accumulator, key) => {
    accumulator[key] = project.inheritWorkspaceDefaults
      ? workspace.capabilities[key] && project.capabilities[key]
      : project.capabilities[key];
    return accumulator;
  }, {} as AgentCapabilityMap);

  const writeActionsAllowed = project.inheritWorkspaceDefaults
    ? workspace.allowWriteActions && project.allowWriteActions
    : project.allowWriteActions;

  return {
    ...project,
    enabled: systemControl.globalEnabled && workspace.enabled && project.enabled,
    modelConfigId: workspace.modelConfigId ?? null,
    allowWriteActions: systemControl.allowWriteActions && writeActionsAllowed,
    executionMode: project.inheritWorkspaceDefaults ? workspace.executionMode : project.executionMode,
    provider: workspace.provider,
    model: workspace.model,
    requireApprovalForWrites: workspace.requireApprovalForWrites || systemControl.requireSupervisionForAutoMode,
    dailyRunLimit: workspace.dailyRunLimit,
    capabilities,
  };
}

export function getSuggestedModelForProvider(provider: AgentProvider) {
  return AGENT_PROVIDER_DEFAULT_MODELS[provider];
}

export function getAgentProviderReadiness(
  provider: AgentProvider,
  model?: string,
  credential?: {
    configured: boolean;
    source: 'workspace' | 'server_env' | null;
    label: string | null;
    updatedAt: string | null;
  }
): AgentProviderReadiness {
  const envMap: Record<Exclude<AgentProvider, 'native' | 'custom'>, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    azure: 'AZURE_OPENAI_API_KEY',
  };

  if (provider === 'native') {
    return {
      ready: true,
      summary: 'TaskNebula native planning engine is available.',
      configured: true,
      source: 'server_env',
      label: 'Built-in planner',
      updatedAt: null,
    };
  }

  if (provider === 'custom') {
    return {
      ready: false,
      summary: 'Custom providers need a server-side adapter before agent runs can call them.',
      configured: false,
      source: null,
      label: null,
      updatedAt: null,
    };
  }

  if (provider === 'anthropic' || provider === 'azure') {
    return {
      ready: false,
      summary: `${provider} is selectable in settings, but this open-source build does not ship a runnable ${provider} adapter yet.`,
      configured: Boolean(credential?.configured),
      source: credential?.source ?? null,
      label: credential?.label ?? null,
      updatedAt: credential?.updatedAt ?? null,
    };
  }

  if (provider === 'openai' && (!model?.trim() || model.startsWith('tasknebula-'))) {
    return {
      ready: false,
      summary: 'OpenAI is selected, but the configured model is still a native placeholder. Choose a real OpenAI model such as gpt-5.4.',
      configured: Boolean(credential?.configured),
      source: credential?.source ?? null,
      label: credential?.label ?? null,
      updatedAt: credential?.updatedAt ?? null,
    };
  }

  if (!credential?.configured) {
    const envVar = envMap[provider];
    return {
      ready: false,
      summary: envVar
        ? `${provider} is selected but no workspace credential or ${envVar} server variable is configured.`
        : `${provider} is selected but no credential is configured.`,
      configured: false,
      source: null,
      label: null,
      updatedAt: null,
    };
  }

  const envVar = envMap[provider];
  return {
    ready: true,
    summary: credential.source === 'workspace'
      ? `${provider} is ready through the workspace credential.`
      : `${provider} is ready through ${envVar}.`,
    configured: true,
    source: credential.source,
    label: credential.label,
    updatedAt: credential.updatedAt,
  };
}

function isNativePlaceholderModel(model?: string) {
  return !model?.trim() || model.startsWith('tasknebula-');
}

function getProviderConfigIssue(
  provider: AgentProvider,
  model: string,
  providerStatus: AgentProviderReadiness
): AgentConfigIssue | null {
  if (providerStatus.ready) {
    return null;
  }

  if (provider === 'openai' && isNativePlaceholderModel(model)) {
    return {
      code: 'provider_model_invalid',
      scope: 'provider',
      severity: 'error',
      title: 'OpenAI model is not configured',
      detail: 'OpenAI is selected, but the current model is still the native placeholder.',
      resolution: 'Choose a real OpenAI model such as gpt-5.4 before running agents.',
      blocksRuns: true,
    };
  }

  if (provider === 'openai' && !providerStatus.configured) {
    return {
      code: 'provider_missing_credential',
      scope: 'provider',
      severity: 'error',
      title: 'OpenAI API key is missing',
      detail: 'OpenAI is selected but no workspace key or OPENAI_API_KEY server variable is configured.',
      resolution: 'Add an OpenAI API key in Settings > AI & Agents, or provide OPENAI_API_KEY on the server.',
      blocksRuns: true,
    };
  }

  if (provider === 'anthropic' || provider === 'azure' || provider === 'custom') {
    return {
      code: 'provider_adapter_unavailable',
      scope: 'provider',
      severity: 'error',
      title: `${provider} adapter is not runnable`,
      detail: providerStatus.summary,
      resolution: 'Switch to TaskNebula native or OpenAI, or ship the missing server adapter before enabling runs.',
      blocksRuns: true,
    };
  }

  return {
    code: 'provider_missing_credential',
    scope: 'provider',
    severity: 'error',
    title: 'Provider configuration needs attention',
    detail: providerStatus.summary,
    resolution: 'Fix the selected provider configuration before attempting another run.',
    blocksRuns: true,
  };
}

export function getWorkspaceAgentConfigIssues(params: {
  workspaceSettings: WorkspaceAgentSettings;
  providerStatus: AgentProviderReadiness;
  systemControl?: SystemAgentControlSettings;
}) {
  const { workspaceSettings, providerStatus } = params;
  const systemControl = params.systemControl ?? DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS;
  const issues: AgentConfigIssue[] = [];

  if (!systemControl.globalEnabled) {
    issues.push({
      code: 'global_paused',
      scope: 'system',
      severity: 'error',
      title: 'Agents are paused globally',
      detail: 'The admin control plane is currently pausing all agent execution.',
      resolution: 'Open Admin > AI Ops and re-enable the global control plane.',
      blocksRuns: true,
    });
  }

  if (!workspaceSettings.enabled) {
    issues.push({
      code: 'workspace_disabled',
      scope: 'workspace',
      severity: 'error',
      title: 'Workspace agents are disabled',
      detail: 'Projects in this workspace cannot start AI runs until workspace agents are enabled.',
      resolution: 'Turn on "Workspace agents" in this settings screen.',
      blocksRuns: true,
    });
  }

  const providerIssue = getProviderConfigIssue(
    workspaceSettings.provider,
    workspaceSettings.model,
    providerStatus
  );
  if (providerIssue) {
    issues.push(providerIssue);
  }

  if (!workspaceSettings.allowWriteActions) {
    issues.push({
      code: 'writes_preview_only',
      scope: 'workspace',
      severity: 'info',
      title: 'Writes are in preview only',
      detail: 'Backlog updates and sprint creation will stay in preview mode even when a project requests live execution.',
      resolution: 'Enable "Allow write actions" if you want agents to make live project changes.',
      blocksRuns: false,
    });
  } else if (workspaceSettings.requireApprovalForWrites) {
    issues.push({
      code: 'write_approval_required',
      scope: 'workspace',
      severity: 'warning',
      title: 'Live writes still require approval',
      detail: 'Projects can prepare live changes, but they still need approval before the write path is used.',
      resolution: 'Disable "Require approval for writes" only if you want fully unsupervised live updates.',
      blocksRuns: false,
    });
  }

  if (workspaceSettings.executionMode === 'auto' && systemControl.requireSupervisionForAutoMode) {
    issues.push({
      code: 'auto_mode_supervised',
      scope: 'system',
      severity: 'warning',
      title: 'Auto mode is still supervised',
      detail: 'The workspace requests autonomous execution, but admin policy still keeps auto mode under supervision.',
      resolution: 'Adjust the admin supervision rule only if you want fully autonomous agent execution.',
      blocksRuns: false,
    });
  }

  return issues;
}

export function getProjectAgentConfigIssues(params: {
  workspaceSettings: WorkspaceAgentSettings;
  projectSettings: ProjectAgentSettings;
  effectiveSettings: EffectiveProjectAgentSettings;
  providerStatus: AgentProviderReadiness;
  systemControl?: SystemAgentControlSettings;
}) {
  const {
    workspaceSettings,
    projectSettings,
    effectiveSettings,
    providerStatus,
  } = params;
  const systemControl = params.systemControl ?? DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS;
  const issues: AgentConfigIssue[] = [];

  if (!systemControl.globalEnabled) {
    issues.push({
      code: 'global_paused',
      scope: 'system',
      severity: 'error',
      title: 'Agents are paused globally',
      detail: 'The admin control plane is currently pausing all agent execution.',
      resolution: 'Open Admin > AI Ops and re-enable the global control plane.',
      blocksRuns: true,
    });
  }

  if (!workspaceSettings.enabled) {
    issues.push({
      code: 'workspace_disabled',
      scope: 'workspace',
      severity: 'error',
      title: 'Workspace agents are disabled',
      detail: 'This project inherits a workspace policy that currently blocks all AI runs.',
      resolution: 'Open Settings > AI & Agents and enable workspace agents first.',
      blocksRuns: true,
    });
  }

  if (!projectSettings.enabled) {
    issues.push({
      code: 'project_disabled',
      scope: 'project',
      severity: 'error',
      title: 'Project agents are disabled',
      detail: 'This project has AI agents turned off in project settings.',
      resolution: 'Enable project agents in this project before running scans or planning flows.',
      blocksRuns: true,
    });
  }

  const providerIssue = getProviderConfigIssue(
    effectiveSettings.provider,
    effectiveSettings.model,
    providerStatus
  );
  if (providerIssue) {
    issues.push(providerIssue);
  }

  if (!effectiveSettings.allowWriteActions) {
    issues.push({
      code: 'writes_preview_only',
      scope: 'project',
      severity: 'info',
      title: 'Live writes are disabled',
      detail: 'Runs can still execute, but backlog edits and sprint creation stay in preview mode.',
      resolution: 'Enable write actions in workspace and project policy if you want live changes.',
      blocksRuns: false,
    });
  } else if (effectiveSettings.requireApprovalForWrites) {
    issues.push({
      code: 'write_approval_required',
      scope: 'project',
      severity: 'warning',
      title: 'Write approval is still required',
      detail: 'The write pipeline is available, but it still requires approval before live changes are committed.',
      resolution: 'Remove the approval guard only if you want unsupervised live writes.',
      blocksRuns: false,
    });
  }

  if (effectiveSettings.executionMode === 'auto' && systemControl.requireSupervisionForAutoMode) {
    issues.push({
      code: 'auto_mode_supervised',
      scope: 'system',
      severity: 'warning',
      title: 'Autonomous mode is supervised',
      detail: 'This project is set to auto mode, but admin policy still keeps autonomous execution supervised.',
      resolution: 'Adjust the admin supervision rule only if full autonomous operation is intentional.',
      blocksRuns: false,
    });
  }

  return issues;
}

export function getProjectAgentRunAvailability(params: {
  workspaceSettings: WorkspaceAgentSettings;
  projectSettings: ProjectAgentSettings;
  effectiveSettings: EffectiveProjectAgentSettings;
  providerStatus: AgentProviderReadiness;
  systemControl?: SystemAgentControlSettings;
}): ProjectAgentRunAvailability {
  const issues = getProjectAgentConfigIssues(params);
  const blockingIssue = issues.find((issue) => issue.blocksRuns) ?? null;

  return {
    canRun: !blockingIssue,
    reason: blockingIssue?.detail ?? null,
    blockingIssue,
    issues,
  };
}
