/**
 * @jest-environment node
 */

import {
  BootstrapperError,
  generateWorkspaceSeed,
  generateWorkspaceSeedNative,
  workspaceSeedSchema,
} from '../bootstrapper';

const NOW = new Date('2026-05-14T00:00:00.000Z');

describe('generateWorkspaceSeedNative', () => {
  it('returns a schema-valid seed for a typical request', () => {
    const seed = generateWorkspaceSeedNative({
      projectDescription: 'We are building a running route tracker mobile app.',
      teamSize: '2-5',
      role: 'engineering',
      now: NOW,
    });
    expect(workspaceSeedSchema.safeParse(seed).success).toBe(true);
    expect(seed.teams.length).toBeGreaterThan(0);
    expect(seed.cycles.length).toBeGreaterThanOrEqual(1);
    expect(seed.issues.length).toBeGreaterThanOrEqual(4);
    // First cycle starts today.
    expect(seed.cycles[0]!.startDate).toBe('2026-05-14');
  });

  it('tailors teams to size = solo', () => {
    const seed = generateWorkspaceSeedNative({
      projectDescription: 'A side-project blog engine.',
      teamSize: 'solo',
      role: 'founder',
      now: NOW,
    });
    expect(seed.teams).toEqual([{ name: 'Core', slug: 'core' }]);
  });

  it('adds design-specific issue when role = design', () => {
    const seed = generateWorkspaceSeedNative({
      projectDescription: 'A design system rebuild.',
      teamSize: '6-15',
      role: 'design',
      now: NOW,
    });
    expect(seed.issues.some((i) => i.assigneeRole === 'design')).toBe(true);
    expect(seed.labels.some((l) => l.name === 'ui')).toBe(true);
  });

  it('throws on empty description', () => {
    expect(() =>
      generateWorkspaceSeedNative({
        projectDescription: '',
        teamSize: '2-5',
        role: 'engineering',
        now: NOW,
      })
    ).toThrow(BootstrapperError);
  });
});

describe('generateWorkspaceSeed routing', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    }
    jest.restoreAllMocks();
  });

  it('falls back to native when no key + provider not forced', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const seed = await generateWorkspaceSeed({
      projectDescription: 'Test description for the runtime path.',
      teamSize: '2-5',
      role: 'product',
      now: NOW,
    });
    expect(workspaceSeedSchema.safeParse(seed).success).toBe(true);
  });

  it('uses anthropic when key is available + parses mocked response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    const stubSeed = {
      projectName: 'Acme Launch',
      projectKey: 'ACME',
      teams: [{ name: 'Engineering', slug: 'engineering' }],
      labels: [
        { name: 'bug', color: '#ef4444' },
        { name: 'feature', color: '#3b82f6' },
      ],
      priorities: ['critical', 'high', 'medium', 'low'],
      cycles: [
        { name: 'Cycle 1', startDate: '2026-05-14', endDate: '2026-05-27' },
      ],
      issues: [
        {
          title: 'Initial scoping',
          description: 'Capture v0.1 scope',
          labels: ['feature'],
          priority: 'high',
          estimateHours: 3,
        },
      ],
    };

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify(stubSeed) }],
      }),
    });

    const seed = await generateWorkspaceSeed({
      projectDescription: 'Build Acme launch site.',
      teamSize: '2-5',
      role: 'engineering',
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: NOW,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init as RequestInit).method).toBe('POST');
    expect(seed.projectName).toBe('Acme Launch');
    expect(seed.cycles[0]!.startDate).toBe('2026-05-14');
  });

  it('strips markdown fences from the LLM response', async () => {
    const stubSeed = {
      projectName: 'Demo',
      projectKey: 'DEMO',
      teams: [{ name: 'Core', slug: 'core' }],
      labels: [],
      priorities: ['high', 'medium'],
      cycles: [{ name: 'C1', startDate: '2026-05-14', endDate: '2026-05-21' }],
      issues: [
        {
          title: 'Kickoff',
          description: null,
          labels: [],
          priority: 'medium',
          estimateHours: null,
        },
      ],
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: '```json\n' + JSON.stringify(stubSeed) + '\n```' },
        ],
      }),
    });
    const seed = await generateWorkspaceSeed({
      projectDescription: 'demo',
      teamSize: '2-5',
      role: 'engineering',
      apiKey: 'sk-ant',
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: NOW,
    });
    expect(seed.projectName).toBe('Demo');
  });

  it('wraps non-JSON LLM output as invalid_json BootstrapperError', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'sorry, no JSON for you' }] }),
    });
    await expect(
      generateWorkspaceSeed({
        projectDescription: 'demo',
        teamSize: '2-5',
        role: 'engineering',
        apiKey: 'sk-ant',
        fetchImpl: fetchMock as unknown as typeof fetch,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: 'invalid_json' });
  });

  it('wraps schema-violating output as schema_violation', async () => {
    const bad = {
      projectName: '',
      projectKey: 'no',
      teams: [],
      labels: [],
      priorities: [],
      cycles: [],
      issues: [],
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: JSON.stringify(bad) }] }),
    });
    await expect(
      generateWorkspaceSeed({
        projectDescription: 'demo',
        teamSize: '2-5',
        role: 'engineering',
        apiKey: 'sk-ant',
        fetchImpl: fetchMock as unknown as typeof fetch,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: 'schema_violation' });
  });

  it('wraps provider HTTP errors as provider_error', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    });
    await expect(
      generateWorkspaceSeed({
        projectDescription: 'demo',
        teamSize: '2-5',
        role: 'engineering',
        apiKey: 'sk-ant',
        fetchImpl: fetchMock as unknown as typeof fetch,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: 'provider_error' });
  });

  it('rejects when forced to anthropic with no key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      generateWorkspaceSeed({
        projectDescription: 'x',
        teamSize: '2-5',
        role: 'engineering',
        provider: 'anthropic',
      })
    ).rejects.toMatchObject({ code: 'missing_credential' });
  });
});
