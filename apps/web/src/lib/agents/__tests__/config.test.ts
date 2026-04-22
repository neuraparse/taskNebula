import {
  DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS,
  getAgentProviderReadiness,
  getProjectAgentRunAvailability,
  getWorkspaceAgentConfigIssues,
  normalizeProjectAgentSettings,
  normalizeWorkspaceAgentSettings,
  resolveEffectiveProjectAgentSettings,
} from '@/lib/agents/config';

describe('agent config', () => {
  it('normalizes workspace settings safely — capabilities default OFF (opt-in)', () => {
    const settings = normalizeWorkspaceAgentSettings({
      enabled: true,
      modelConfigId: 'config_123',
      provider: 'openai',
      model: 'gpt-5.4',
      capabilities: {
        // Admin explicitly opts into backlog_triage; other capabilities
        // stay false because the safe default is "nothing runs unless I
        // turn it on".
        backlog_triage: true,
      },
    });

    expect(settings.enabled).toBe(true);
    expect(settings.assistantEnabled).toBe(false);
    expect(settings.modelConfigId).toBe('config_123');
    expect(settings.provider).toBe('openai');
    expect(settings.model).toBe('gpt-5.4');
    expect(settings.capabilities.backlog_triage).toBe(true);
    expect(settings.capabilities.project_tracking).toBe(false);
    expect(settings.capabilities.sprint_planning).toBe(false);
    expect(settings.capabilities.bulk_sprint_creation).toBe(false);
  });

  it('keeps assistantEnabled independent from agents enabled', () => {
    const settings = normalizeWorkspaceAgentSettings({
      enabled: false,
      assistantEnabled: true,
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
    expect(settings.assistantEnabled).toBe(true);
    expect(settings.enabled).toBe(false);
  });

  it('resolves effective project settings by intersecting workspace and project safety rules', () => {
    const workspace = normalizeWorkspaceAgentSettings({
      enabled: true,
      allowWriteActions: true,
      capabilities: {
        backlog_triage: true,
        bulk_sprint_creation: false,
      },
    });

    const project = normalizeProjectAgentSettings({
      enabled: true,
      allowWriteActions: true,
      capabilities: {
        backlog_triage: true,
        bulk_sprint_creation: true,
      },
    });

    const effective = resolveEffectiveProjectAgentSettings(
      workspace,
      project,
      { ...DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS, globalEnabled: true }
    );

    expect(effective.enabled).toBe(true);
    expect(effective.allowWriteActions).toBe(true);
    expect(effective.capabilities.backlog_triage).toBe(true);
    expect(effective.capabilities.bulk_sprint_creation).toBe(false);
  });

  it('reports OpenAI as not ready when the model is still a native placeholder', () => {
    const readiness = getAgentProviderReadiness('openai', 'tasknebula-planner-v1');

    expect(readiness.ready).toBe(false);
    expect(readiness.summary).toContain('placeholder');
  });

  it('builds actionable workspace issues when provider credentials are missing', () => {
    const workspace = normalizeWorkspaceAgentSettings({
      enabled: true,
      provider: 'openai',
      model: 'gpt-5',
    });
    const providerStatus = getAgentProviderReadiness('openai', 'gpt-5', {
      configured: false,
      source: null,
      label: null,
      updatedAt: null,
    });

    const issues = getWorkspaceAgentConfigIssues({
      workspaceSettings: workspace,
      providerStatus,
      systemControl: DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS,
    });

    expect(issues.some((issue) => issue.code === 'provider_missing_credential' && issue.blocksRuns)).toBe(true);
  });

  it('blocks project runs when workspace provider setup is incomplete', () => {
    const workspace = normalizeWorkspaceAgentSettings({
      enabled: true,
      provider: 'openai',
      model: 'gpt-5',
    });
    const project = normalizeProjectAgentSettings({
      enabled: true,
    });
    const platformOn = { ...DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS, globalEnabled: true };
    const effective = resolveEffectiveProjectAgentSettings(workspace, project, platformOn);
    const providerStatus = getAgentProviderReadiness('openai', 'gpt-5', {
      configured: false,
      source: null,
      label: null,
      updatedAt: null,
    });

    const availability = getProjectAgentRunAvailability({
      workspaceSettings: workspace,
      projectSettings: project,
      effectiveSettings: effective,
      providerStatus,
      systemControl: platformOn,
    });

    expect(availability.canRun).toBe(false);
    expect(availability.blockingIssue?.code).toBe('provider_missing_credential');
  });
});
