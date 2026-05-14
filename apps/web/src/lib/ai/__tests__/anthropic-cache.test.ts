/**
 * @jest-environment node
 *
 * End-to-end check that the Anthropic agent path now sends a structured
 * `system` array with `cache_control: { type: "ephemeral" }` markers on
 * the stable prefix.
 */

import { generateAgentPlan } from '../../agents/providers';

describe('Anthropic provider applies prompt cache markers', () => {
  const originalFetch = global.fetch;
  const originalFlag = process.env.AI_PROMPT_CACHE_ENABLED;
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalFlag === undefined) {
      delete process.env.AI_PROMPT_CACHE_ENABLED;
    } else {
      process.env.AI_PROMPT_CACHE_ENABLED = originalFlag;
    }
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
    jest.restoreAllMocks();
  });

  // Build the minimum shape the provider expects. Most fields are unused
  // by the heuristics the helper triggers under `project_tracking`.
  function makeParams(): any {
    return {
      kind: 'project_tracking',
      model: 'claude-sonnet-4-6',
      apiKey: 'sk-ant-test',
      modelTuning: null,
      effectiveSettings: {
        provider: 'anthropic',
        executionMode: 'manual',
        issueCapacityPerSprint: 10,
        sprintBatchSize: 2,
      },
      context: {
        project: { id: 'p1', key: 'P', name: 'P' },
        issues: [],
        sprints: [],
      },
    };
  }

  function mockAnthropicResponse(json: any) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => json,
    }) as any;
  }

  it('sends system as an array with ephemeral cache_control on the tail', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'true';
    mockAnthropicResponse({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'ok',
            recommendations: [],
            highlights: [],
          }),
        },
      ],
      usage: {
        input_tokens: 200,
        output_tokens: 50,
        cache_read_input_tokens: 180,
        cache_creation_input_tokens: 20,
      },
    });

    await generateAgentPlan(makeParams());

    const fetchMock = global.fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['anthropic-beta']).toBe(
      'prompt-caching-2024-07-31'
    );
    const body = JSON.parse(init.body);
    expect(Array.isArray(body.system)).toBe(true);
    const lastSystem = body.system[body.system.length - 1];
    expect(lastSystem.cache_control).toEqual({ type: 'ephemeral' });
    // Dynamic content must stay in messages, not system.
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('omits cache_control when the feature flag is disabled', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'false';
    mockAnthropicResponse({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'ok',
            recommendations: [],
            highlights: [],
          }),
        },
      ],
    });

    await generateAgentPlan(makeParams());

    const fetchMock = global.fetch as jest.Mock;
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect((init.headers as Record<string, string>)['anthropic-beta']).toBeUndefined();
    for (const block of body.system) {
      expect(block.cache_control).toBeUndefined();
    }
  });
});
