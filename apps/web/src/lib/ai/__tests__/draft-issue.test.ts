/**
 * @jest-environment node
 */

import {
  AiDraftError,
  draftIssue,
  draftIssueNative,
  issueDraftSchema,
} from '../draft-issue';

describe('draftIssueNative heuristic', () => {
  const baseReq = {
    projectName: 'ACME',
    projectKey: 'ACME',
    provider: 'native' as const,
    apiKey: null,
    existingLabels: [],
  };

  it('classifies bugs from keywords', () => {
    const draft = draftIssueNative({ ...baseReq, prompt: 'Login button broken on Safari' });
    expect(draft.type).toBe('bug');
    expect(draft.labels).toEqual(expect.arrayContaining(['bug']));
    expect(draft.title.length).toBeGreaterThan(0);
  });

  it('bumps priority on urgency cues', () => {
    const draft = draftIssueNative({
      ...baseReq,
      prompt: 'URGENT: payments API returns 500 for all users',
    });
    expect(draft.priority).toBe('critical');
  });

  it('falls back to task + medium for neutral prompts', () => {
    const draft = draftIssueNative({ ...baseReq, prompt: 'Add a page for team members' });
    expect(draft.type).toBe('task');
    expect(draft.priority).toBe('medium');
  });

  it('always yields a schema-valid draft', () => {
    const draft = draftIssueNative({ ...baseReq, prompt: 'something something' });
    expect(issueDraftSchema.safeParse(draft).success).toBe(true);
  });
});

describe('draftIssue (OpenAI adapter)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws AiDraftError with missing_credential when no apiKey', async () => {
    await expect(
      draftIssue({
        prompt: 'anything',
        projectName: 'P',
        projectKey: 'P',
        provider: 'openai',
        apiKey: null,
      })
    ).rejects.toBeInstanceOf(AiDraftError);
  });

  it('parses JSON output from OpenAI response_format=json_object', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              type: 'task',
              title: 'Ship onboarding email',
              description: 'Send welcome mail on signup',
              priority: 'medium',
              labels: ['email', 'onboarding'],
              estimate: 3,
            }),
          },
        },
      ],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as any;

    const draft = await draftIssue({
      prompt: 'need onboarding email on signup',
      projectName: 'P',
      projectKey: 'P',
      provider: 'openai',
      apiKey: 'sk-test',
    });

    expect(draft.type).toBe('task');
    expect(draft.title).toBe('Ship onboarding email');
    expect(draft.labels).toContain('email');
  });

  it('wraps provider HTTP failures into AiDraftError', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limit',
    }) as any;

    await expect(
      draftIssue({
        prompt: 'x',
        projectName: 'P',
        projectKey: 'P',
        provider: 'openai',
        apiKey: 'sk-test',
      })
    ).rejects.toMatchObject({ code: 'provider_error' });
  });

  it('rejects schema-invalid output as AiDraftError("schema_violation")', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ type: 'nonsense', title: '' }) } }],
      }),
    }) as any;

    await expect(
      draftIssue({
        prompt: 'x',
        projectName: 'P',
        projectKey: 'P',
        provider: 'openai',
        apiKey: 'sk-test',
      })
    ).rejects.toMatchObject({ code: 'schema_violation' });
  });
});

describe('draftIssue (Anthropic adapter)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses Anthropic messages API text blocks', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              type: 'bug',
              title: 'Fix flaky test',
              description: null,
              priority: 'high',
              labels: ['tests'],
              estimate: null,
            }),
          },
        ],
      }),
    }) as any;

    const draft = await draftIssue({
      prompt: 'flaky test in ci',
      projectName: 'P',
      projectKey: 'P',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
    });
    expect(draft.type).toBe('bug');
    expect(draft.priority).toBe('high');
  });

  it('strips markdown fences before parsing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: '```json\n' +
              JSON.stringify({
                type: 'task',
                title: 'Do a thing',
                description: null,
                priority: 'medium',
                labels: [],
              }) +
              '\n```',
          },
        ],
      }),
    }) as any;

    const draft = await draftIssue({
      prompt: 'do a thing',
      projectName: 'P',
      projectKey: 'P',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
    });
    expect(draft.title).toBe('Do a thing');
  });
});
