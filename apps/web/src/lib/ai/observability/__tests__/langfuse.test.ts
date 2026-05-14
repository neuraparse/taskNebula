/**
 * @jest-environment node
 *
 * Verifies that the AI engine entry points call `traceLlmCall` with the
 * expected payload — covering the happy path, the env-off short-circuit,
 * and the failure path that still ships an error trace.
 */

import { traceLlmCall, _resetLangfuseClientForTests } from '../langfuse';

// Mock the langfuse SDK so we don't actually fire a network request. The
// factory hoists above imports, so we expose the mocks as named exports on
// the mocked module and read them back in each test.
jest.mock('langfuse', () => {
  const generation = jest.fn();
  const trace = jest.fn(() => ({ generation }));
  const flushAsync = jest.fn().mockResolvedValue(undefined);
  const Langfuse = jest.fn().mockImplementation(() => ({ trace, flushAsync }));
  return {
    __esModule: true,
    Langfuse,
    __mocks: { trace, generation, flushAsync, Langfuse },
  };
});

function getMocks() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('langfuse') as { __mocks: { trace: jest.Mock; generation: jest.Mock; flushAsync: jest.Mock } };
  return mod.__mocks;
}

beforeEach(() => {
  _resetLangfuseClientForTests();
  delete process.env.LANGFUSE_PUBLIC_KEY;
  delete process.env.LANGFUSE_SECRET_KEY;
  const m = getMocks();
  m.trace.mockClear();
  m.generation.mockClear();
  m.flushAsync.mockClear();
});

describe('traceLlmCall', () => {
  it('no-ops when LANGFUSE_PUBLIC_KEY is not set', async () => {
    await traceLlmCall({
      feature: 'issue.draft',
      provider: 'openai',
      model: 'gpt-4o-mini',
      input: { prompt: 'hi' },
      output: { type: 'task' },
      latencyMs: 50,
    });
    const m = getMocks();
    expect(m.trace).not.toHaveBeenCalled();
    expect(m.generation).not.toHaveBeenCalled();
  });

  it('emits a Langfuse trace + generation when env is configured', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';

    await traceLlmCall({
      feature: 'issue.draft',
      provider: 'openai',
      model: 'gpt-4o-mini',
      input: { prompt: 'add login' },
      output: { type: 'task', title: 'Add login' },
      latencyMs: 123,
      tokens: { prompt: 12, completion: 34, total: 46 },
      userId: 'user-1',
      organizationId: 'org-1',
    });

    const m = getMocks();
    expect(m.trace).toHaveBeenCalledTimes(1);
    const traceArg = m.trace.mock.calls[0][0];
    expect(traceArg.name).toBe('issue.draft');
    expect(traceArg.userId).toBe('user-1');
    expect(traceArg.metadata.provider).toBe('openai');
    expect(traceArg.metadata.organizationId).toBe('org-1');
    expect(traceArg.tags).toEqual(
      expect.arrayContaining([
        'feature:issue.draft',
        'provider:openai',
        'model:gpt-4o-mini',
      ])
    );

    expect(m.generation).toHaveBeenCalledTimes(1);
    const genArg = m.generation.mock.calls[0][0];
    expect(genArg.model).toBe('gpt-4o-mini');
    expect(genArg.usage).toEqual({ input: 12, output: 34, total: 46 });
    expect(genArg.level).toBe('DEFAULT');
    expect(m.flushAsync).toHaveBeenCalled();
  });

  it('marks the generation as ERROR when errorMessage is provided', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';

    await traceLlmCall({
      feature: 'issue.draft',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      input: { prompt: 'x' },
      output: null,
      latencyMs: 200,
      errorMessage: 'rate limit',
    });

    const m = getMocks();
    const genArg = m.generation.mock.calls[0][0];
    expect(genArg.level).toBe('ERROR');
    expect(genArg.statusMessage).toBe('rate limit');
    expect(genArg.output).toEqual({ error: 'rate limit' });
  });
});

describe('draftIssue → traceLlmCall integration', () => {
  // We mock the langfuse module the same way as above; this block exercises
  // the call-site inside draftIssue() to prove the wrapper calls our helper
  // with the right args after a successful OpenAI response.
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('emits an issue.draft trace after a successful OpenAI call', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    _resetLangfuseClientForTests();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                type: 'task',
                title: 'Add login page',
                description: null,
                priority: 'medium',
                labels: [],
                estimate: null,
              }),
            },
          },
        ],
      }),
    }) as any;

    const { draftIssue } = await import('../../draft-issue');
    await draftIssue({
      prompt: 'add login',
      projectName: 'ACME',
      projectKey: 'ACME',
      provider: 'openai',
      apiKey: 'sk-key',
      model: 'gpt-4o-mini',
    });

    const m = getMocks();
    expect(m.trace).toHaveBeenCalled();
    const traceArg = m.trace.mock.calls[0][0];
    expect(traceArg.name).toBe('issue.draft');
    expect(traceArg.metadata.provider).toBe('openai');

    const genArg = m.generation.mock.calls[0][0];
    expect(genArg.model).toBe('gpt-4o-mini');
    expect(genArg.input).toMatchObject({ projectKey: 'ACME' });
    expect(genArg.output).toMatchObject({ title: 'Add login page' });
  });

  it('emits an ERROR trace when the LLM call throws', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    _resetLangfuseClientForTests();

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limit',
    }) as any;

    const { draftIssue } = await import('../../draft-issue');
    await expect(
      draftIssue({
        prompt: 'add login',
        projectName: 'P',
        projectKey: 'P',
        provider: 'openai',
        apiKey: 'sk-key',
        model: 'gpt-4o-mini',
      })
    ).rejects.toThrow();

    const m = getMocks();
    expect(m.trace).toHaveBeenCalled();
    const genArg = m.generation.mock.calls[0][0];
    expect(genArg.level).toBe('ERROR');
    expect(typeof genArg.statusMessage).toBe('string');
  });

  it('does NOT call traceLlmCall for native provider', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    _resetLangfuseClientForTests();

    const { draftIssue } = await import('../../draft-issue');
    await draftIssue({
      prompt: 'something',
      projectName: 'P',
      projectKey: 'P',
      provider: 'native',
      apiKey: null,
    });

    const m = getMocks();
    expect(m.trace).not.toHaveBeenCalled();
  });
});
