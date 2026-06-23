import {
  buildLocalAgentPrompt,
  getLocalAgentRunnerStatus,
  isLocalAgentEndpoint,
  resolveLocalAgentRunner,
} from '../local-runner';

const ORIGINAL_ENV = { ...process.env };

describe('local agent runner config', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.TASKNEBULA_LOCAL_AGENT_RUNNER_ENABLED;
    delete process.env.TASKNEBULA_LOCAL_AGENT_CWD;
    delete process.env.TASKNEBULA_REPO_ROOT;
    delete process.env.TASKNEBULA_LOCAL_CODEX_ENABLED;
    delete process.env.TASKNEBULA_LOCAL_CODEX_CWD;
    delete process.env.TASKNEBULA_LOCAL_CODEX_COMMAND;
    delete process.env.TASKNEBULA_LOCAL_CODEX_MODEL;
    delete process.env.TASKNEBULA_LOCAL_CODEX_SANDBOX;
    delete process.env.TASKNEBULA_LOCAL_CLAUDE_ENABLED;
    delete process.env.TASKNEBULA_LOCAL_CLAUDE_CWD;
    delete process.env.TASKNEBULA_LOCAL_CLAUDE_COMMAND;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('detects local endpoint URLs', () => {
    expect(isLocalAgentEndpoint('local://codex')).toBe(true);
    expect(isLocalAgentEndpoint('https://example.test/agent')).toBe(false);
  });

  it('reports disabled when no env or provider switch enables the runner', () => {
    const status = getLocalAgentRunnerStatus('codex');

    expect(status).toMatchObject({
      provider: 'codex',
      configured: false,
      reasonCode: 'disabled',
    });
  });

  it('resolves a Codex runner from a workspace local endpoint', () => {
    process.env.TASKNEBULA_LOCAL_CODEX_COMMAND = process.execPath;
    process.env.TASKNEBULA_LOCAL_CODEX_CWD = process.cwd();
    process.env.TASKNEBULA_LOCAL_CODEX_MODEL = 'gpt-5.5-codex';
    process.env.TASKNEBULA_LOCAL_CODEX_SANDBOX = 'read-only';

    const runner = resolveLocalAgentRunner('codex', 'local://codex', true);

    expect(runner).toMatchObject({
      provider: 'codex',
      command: process.execPath,
      cwd: process.cwd(),
      model: 'gpt-5.5-codex',
      codexSandbox: 'read-only',
      source: 'provider',
    });
  });

  it('reports a missing command when the workspace switch is enabled', () => {
    process.env.TASKNEBULA_LOCAL_CODEX_COMMAND = 'tasknebula-missing-codex-command';
    process.env.TASKNEBULA_LOCAL_CODEX_CWD = process.cwd();

    const status = getLocalAgentRunnerStatus('codex', 'local://codex', true);

    expect(status).toMatchObject({
      configured: false,
      reasonCode: 'command_missing',
      reasonDetail: 'tasknebula-missing-codex-command',
    });
    expect(resolveLocalAgentRunner('codex', 'local://codex', true)).toBeNull();
  });

  it('builds a complete issue handoff prompt for local CLI agents', () => {
    const prompt = buildLocalAgentPrompt({
      sessionId: 'session-1',
      provider: 'codex',
      actorUserId: 'user-1',
      appBaseUrl: 'https://tasknebula.test',
      promptOverride: 'Keep the patch small and run focused tests.',
      issue: {
        id: 'issue-1',
        key: 'TN-42',
        title: 'Fix assignment notifications',
        description: 'Task assignment emails are not consistently sent.',
        priority: 'high',
        labels: ['notifications', 'email'],
        projectId: 'project-1',
        organizationId: 'org-1',
        url: 'https://tasknebula.test/issues/issue-1',
        reporterId: 'user-1',
      },
    });

    expect(prompt).toContain('TaskNebula agent handoff');
    expect(prompt).toContain('Issue: TN-42 - Fix assignment notifications');
    expect(prompt).toContain('Issue URL: https://tasknebula.test/issues/issue-1');
    expect(prompt).toContain('Project ID: project-1');
    expect(prompt).toContain('Organization ID: org-1');
    expect(prompt).toContain('Priority: high');
    expect(prompt).toContain('Labels: notifications, email');
    expect(prompt).toContain('Task assignment emails are not consistently sent.');
    expect(prompt).toContain('Admin instructions:');
    expect(prompt).toContain('Keep the patch small and run focused tests.');
    expect(prompt).toContain('End with a concise summary');
  });
});
