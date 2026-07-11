import {
  applyIssueTriageSuggestion,
  getAiCapability,
  listIssueTriageSuggestions,
  runIssueAssist,
  runIssueTriage,
} from './endpoints';
import { configureApi } from './client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('issue triage API', () => {
  beforeAll(() => {
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.mocked(globalThis.fetch).mockReset();
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads AI capability for an organization', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        platformEnabled: true,
        llm: { provider: 'openai', model: 'gpt-5.2', configured: true, source: 'workspace' },
        assistantEnabled: true,
        canDraft: true,
        agentsEnabled: true,
        canRunAgents: true,
      }),
    );

    await expect(getAiCapability('org_1')).resolves.toEqual({
      platformEnabled: true,
      llm: { provider: 'openai', model: 'gpt-5.2', configured: true, source: 'workspace' },
      assistantEnabled: true,
      canDraft: true,
      agentsEnabled: true,
      canRunAgents: true,
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/ai/capability?organizationId=org_1',
    );
  });

  it('lists, runs, and applies issue triage suggestions', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          suggestions: [
            {
              id: 'triage_1',
              issueId: 'issue_1',
              payload: {
                labels: ['bug', 123, 'mobile'],
                priority: 'high',
                suggested_assignee_id: null,
                confidence: '87',
                rationale: 'Crash reports mention mobile auth.',
              },
              confidence: '87',
              appliedAt: null,
              dismissedAt: null,
              createdAt: '2026-06-29T10:00:00.000Z',
            },
            { id: 'missing-issue' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          suggestion: {
            id: 'triage_2',
            issueId: 'issue_1',
            payload: { labels: ['auth'], priority: 'critical', confidence: 92 },
            confidence: 92,
            appliedAt: null,
            dismissedAt: null,
            createdAt: '2026-06-29T10:05:00.000Z',
          },
          payload: { labels: ['auth'], priority: 'critical', confidence: 92 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          applied: { priority: 'critical', labels: ['bug', 'auth'] },
          suggestionId: 'triage_2',
          autoApplied: false,
          threshold: '90',
        }),
      );

    await expect(listIssueTriageSuggestions('issue_1')).resolves.toEqual({
      suggestions: [
        {
          id: 'triage_1',
          issueId: 'issue_1',
          payload: {
            labels: ['bug', 'mobile'],
            priority: 'high',
            suggested_assignee_id: null,
            confidence: 87,
            rationale: 'Crash reports mention mobile auth.',
          },
          confidence: 87,
          appliedAt: null,
          dismissedAt: null,
          createdAt: '2026-06-29T10:00:00.000Z',
        },
      ],
    });

    await expect(runIssueTriage('issue_1')).resolves.toMatchObject({
      suggestion: {
        id: 'triage_2',
        payload: { labels: ['auth'], priority: 'critical', confidence: 92 },
      },
    });

    await expect(
      applyIssueTriageSuggestion('issue_1', { suggestionId: 'triage_2', approved: true }),
    ).resolves.toEqual({
      success: true,
      applied: { priority: 'critical', labels: ['bug', 'auth'] },
      suggestionId: 'triage_2',
      autoApplied: false,
      threshold: 90,
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/triage',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
    const [applyUrl, applyInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];
    expect(applyUrl).toBe('https://tasks.example.com/api/issues/issue_1/triage/apply');
    expect(applyInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(applyInit?.body))).toEqual({
      suggestionId: 'triage_2',
      approved: true,
    });
  });

  it('runs AI issue assist actions', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        text: 'Rewrite the description with clearer reproduction steps.',
        labels: ['mobile', 42, 'auth'],
        provider: 'openai',
      }),
    );

    await expect(runIssueAssist({ issueId: 'issue_1', action: 'rewrite' })).resolves.toEqual({
      text: 'Rewrite the description with clearer reproduction steps.',
      labels: ['mobile', 'auth'],
      provider: 'openai',
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/ai/issue-assist');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      issueId: 'issue_1',
      action: 'rewrite',
    });
  });
});
