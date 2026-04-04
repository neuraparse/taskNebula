import {
  AgentExecutionError,
  generateAgentPlan,
} from '@/lib/agents/providers';
import {
  normalizeProjectAgentSettings,
  normalizeWorkspaceAgentSettings,
  resolveEffectiveProjectAgentSettings,
  DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS,
} from '@/lib/agents/config';
import type { ProjectContext } from '@/lib/agents/types';

const context: ProjectContext = {
  project: {
    id: 'project_1',
    organizationId: 'org_1',
    name: 'API Platform',
    key: 'API',
  },
  issues: [
    {
      id: 'issue_1',
      key: 'API-1',
      title: 'Secure refresh token rotation',
      type: 'task',
      priority: 'medium',
      labels: ['auth'],
      dueDate: new Date('2026-04-10T00:00:00.000Z'),
      sprintId: null,
      statusCategory: 'backlog',
      statusName: 'Backlog',
      assigneeId: null,
    },
    {
      id: 'issue_2',
      key: 'API-2',
      title: 'Rate limit burst traffic',
      type: 'bug',
      priority: 'high',
      labels: ['incident'],
      dueDate: new Date('2026-04-08T00:00:00.000Z'),
      sprintId: null,
      statusCategory: 'backlog',
      statusName: 'Backlog',
      assigneeId: 'user_1',
    },
  ],
  sprints: [],
};

function buildEffectiveSettings() {
  return resolveEffectiveProjectAgentSettings(
    normalizeWorkspaceAgentSettings({
      enabled: true,
      provider: 'openai',
      model: 'gpt-5',
      allowWriteActions: true,
    }),
    normalizeProjectAgentSettings({
      enabled: true,
      allowWriteActions: true,
    }),
    DEFAULT_SYSTEM_AGENT_CONTROL_SETTINGS
  );
}

describe('agent providers', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
    jest.restoreAllMocks();
  });

  it('fails clearly when OpenAI is selected without a server API key', async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(
      generateAgentPlan({
        kind: 'project_tracking',
        model: 'gpt-5',
        effectiveSettings: buildEffectiveSettings(),
        context,
      })
    ).rejects.toMatchObject({
      code: 'provider_not_configured',
      statusCode: 503,
    } satisfies Partial<AgentExecutionError>);
  });

  it('parses structured sprint planning output from OpenAI', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  summary: 'Prepared a focused sprint proposal.',
                  plannedSprints: [
                    {
                      name: 'Sprint 12',
                      goal: 'Finish auth hardening.',
                      issueKeys: ['API-2', 'API-1'],
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    }) as typeof fetch;

    const result = await generateAgentPlan({
      kind: 'sprint_planning',
      model: 'gpt-5',
      effectiveSettings: buildEffectiveSettings(),
      context,
    });

    expect(result.kind).toBe('sprint_planning');
    expect(result.summary).toContain('focused sprint proposal');
    expect(result.plannedSprints[0]?.issueKeys).toEqual(['API-2', 'API-1']);
  });

  it('passes model profile tuning into the OpenAI Responses API request', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  summary: 'Prepared a focused sprint proposal.',
                  plannedSprints: [
                    {
                      name: 'Sprint 12',
                      goal: 'Finish auth hardening.',
                      issueKeys: ['API-2', 'API-1'],
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    }) as typeof fetch;

    await generateAgentPlan({
      kind: 'sprint_planning',
      model: 'gpt-5',
      effectiveSettings: buildEffectiveSettings(),
      context,
      modelConfigId: 'config_1',
      modelConfigName: 'Balanced GPT-5',
      modelTuning: {
        temperature: 0.2,
        maxOutputTokens: 640,
        reasoningEffort: 'high',
        notes: 'Use for planning.',
      },
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));

    expect(body.temperature).toBe(0.2);
    expect(body.max_output_tokens).toBe(640);
    expect(body.reasoning).toEqual({ effort: 'high' });
  });

  it('maps OpenAI rate limits into a user-safe agent error', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
        },
      }),
    }) as typeof fetch;

    await expect(
      generateAgentPlan({
        kind: 'backlog_triage',
        model: 'gpt-5',
        effectiveSettings: buildEffectiveSettings(),
        context,
      })
    ).rejects.toMatchObject({
      code: 'provider_rate_limited',
      statusCode: 429,
    } satisfies Partial<AgentExecutionError>);
  });
});
