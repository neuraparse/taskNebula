export type WorkspaceCommunicationsSettings = {
  enabled: boolean;
  voiceEnabled: boolean;
  issueThreadsEnabled: boolean;
  documentThreadsEnabled: boolean;
  attachmentsEnabled: boolean;
  unreadTrackingEnabled: boolean;
};

export type ProjectCommunicationsSettings = {
  enabled: boolean;
  inheritWorkspaceDefaults: boolean;
  voiceEnabled: boolean;
  issueThreadsEnabled: boolean;
  documentThreadsEnabled: boolean;
  attachmentsEnabled: boolean;
  unreadTrackingEnabled: boolean;
};

export type EffectiveProjectCommunicationsSettings = {
  enabled: boolean;
  voiceEnabled: boolean;
  issueThreadsEnabled: boolean;
  documentThreadsEnabled: boolean;
  attachmentsEnabled: boolean;
  unreadTrackingEnabled: boolean;
};

const DEFAULT_WORKSPACE_COMMUNICATIONS_SETTINGS: WorkspaceCommunicationsSettings = {
  enabled: true,
  voiceEnabled: true,
  issueThreadsEnabled: true,
  documentThreadsEnabled: true,
  attachmentsEnabled: true,
  unreadTrackingEnabled: true,
};

const DEFAULT_PROJECT_COMMUNICATIONS_SETTINGS: ProjectCommunicationsSettings = {
  enabled: true,
  inheritWorkspaceDefaults: true,
  voiceEnabled: true,
  issueThreadsEnabled: true,
  documentThreadsEnabled: true,
  attachmentsEnabled: true,
  unreadTrackingEnabled: true,
};

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeWorkspaceCommunicationsSettings(
  raw: unknown
): WorkspaceCommunicationsSettings {
  const settings = (raw as Record<string, unknown> | null) || {};

  return {
    enabled: toBoolean(settings.enabled, DEFAULT_WORKSPACE_COMMUNICATIONS_SETTINGS.enabled),
    voiceEnabled: toBoolean(settings.voiceEnabled, DEFAULT_WORKSPACE_COMMUNICATIONS_SETTINGS.voiceEnabled),
    issueThreadsEnabled: toBoolean(
      settings.issueThreadsEnabled,
      DEFAULT_WORKSPACE_COMMUNICATIONS_SETTINGS.issueThreadsEnabled
    ),
    documentThreadsEnabled: toBoolean(
      settings.documentThreadsEnabled,
      DEFAULT_WORKSPACE_COMMUNICATIONS_SETTINGS.documentThreadsEnabled
    ),
    attachmentsEnabled: toBoolean(
      settings.attachmentsEnabled,
      DEFAULT_WORKSPACE_COMMUNICATIONS_SETTINGS.attachmentsEnabled
    ),
    unreadTrackingEnabled: toBoolean(
      settings.unreadTrackingEnabled,
      DEFAULT_WORKSPACE_COMMUNICATIONS_SETTINGS.unreadTrackingEnabled
    ),
  };
}

export function normalizeProjectCommunicationsSettings(
  raw: unknown
): ProjectCommunicationsSettings {
  const settings = (raw as Record<string, unknown> | null) || {};

  return {
    enabled: toBoolean(settings.enabled, DEFAULT_PROJECT_COMMUNICATIONS_SETTINGS.enabled),
    inheritWorkspaceDefaults: toBoolean(
      settings.inheritWorkspaceDefaults,
      DEFAULT_PROJECT_COMMUNICATIONS_SETTINGS.inheritWorkspaceDefaults
    ),
    voiceEnabled: toBoolean(settings.voiceEnabled, DEFAULT_PROJECT_COMMUNICATIONS_SETTINGS.voiceEnabled),
    issueThreadsEnabled: toBoolean(
      settings.issueThreadsEnabled,
      DEFAULT_PROJECT_COMMUNICATIONS_SETTINGS.issueThreadsEnabled
    ),
    documentThreadsEnabled: toBoolean(
      settings.documentThreadsEnabled,
      DEFAULT_PROJECT_COMMUNICATIONS_SETTINGS.documentThreadsEnabled
    ),
    attachmentsEnabled: toBoolean(
      settings.attachmentsEnabled,
      DEFAULT_PROJECT_COMMUNICATIONS_SETTINGS.attachmentsEnabled
    ),
    unreadTrackingEnabled: toBoolean(
      settings.unreadTrackingEnabled,
      DEFAULT_PROJECT_COMMUNICATIONS_SETTINGS.unreadTrackingEnabled
    ),
  };
}

export function resolveEffectiveProjectCommunicationsSettings(
  workspaceSettings: WorkspaceCommunicationsSettings,
  projectSettings: ProjectCommunicationsSettings
): EffectiveProjectCommunicationsSettings {
  const inherit = projectSettings.inheritWorkspaceDefaults;
  const projectEnabled = projectSettings.enabled;
  const enabled = workspaceSettings.enabled && projectEnabled;

  return {
    enabled,
    voiceEnabled: enabled && (inherit ? workspaceSettings.voiceEnabled && projectSettings.voiceEnabled : projectSettings.voiceEnabled),
    issueThreadsEnabled:
      enabled &&
      (inherit
        ? workspaceSettings.issueThreadsEnabled && projectSettings.issueThreadsEnabled
        : projectSettings.issueThreadsEnabled),
    documentThreadsEnabled:
      enabled &&
      (inherit
        ? workspaceSettings.documentThreadsEnabled && projectSettings.documentThreadsEnabled
        : projectSettings.documentThreadsEnabled),
    attachmentsEnabled:
      enabled &&
      (inherit
        ? workspaceSettings.attachmentsEnabled && projectSettings.attachmentsEnabled
        : projectSettings.attachmentsEnabled),
    unreadTrackingEnabled:
      enabled &&
      (inherit
        ? workspaceSettings.unreadTrackingEnabled && projectSettings.unreadTrackingEnabled
        : projectSettings.unreadTrackingEnabled),
  };
}
