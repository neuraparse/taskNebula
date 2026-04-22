/**
 * @jest-environment node
 */

import { runIssueAssist } from '../issue-assist';

const BASE_ISSUE = {
  key: 'ACME-1',
  type: 'bug',
  title: 'Login spinner never stops',
  description: 'After clicking login, spinner stays indefinitely.',
  priority: 'high',
  labels: ['auth'],
};

describe('runIssueAssist (native fallback)', () => {
  it('summarize — returns non-empty text referencing the issue', async () => {
    const res = await runIssueAssist({
      action: 'summarize',
      provider: 'native',
      issue: BASE_ISSUE,
    });
    expect(res.action).toBe('summarize');
    expect(res.text.length).toBeGreaterThan(10);
    expect(res.text).toContain(BASE_ISSUE.title);
  });

  it('rewrite — echoes description when one exists', async () => {
    const res = await runIssueAssist({
      action: 'rewrite',
      provider: 'native',
      issue: BASE_ISSUE,
    });
    expect(res.text).toContain('After clicking login');
  });

  it('suggest_next — bullet-style output', async () => {
    const res = await runIssueAssist({
      action: 'suggest_next',
      provider: 'native',
      issue: BASE_ISSUE,
    });
    expect(res.text.split('\n').some((l) => l.trim().startsWith('-'))).toBe(true);
  });

  it('suggest_labels — heuristic matches title keywords', async () => {
    const res = await runIssueAssist({
      action: 'suggest_labels',
      provider: 'native',
      issue: {
        ...BASE_ISSUE,
        title: 'UI bug in frontend component',
        description: 'Auth flow broken',
      },
    });
    expect(res.labels).toBeDefined();
    expect(res.labels!).toEqual(
      expect.arrayContaining(['frontend', 'bug', 'security'])
    );
  });
});

describe('runIssueAssist (OpenAI adapter)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('summarize — returns the LLM text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Auth broken, needs investigation.' } }],
      }),
    }) as any;

    const res = await runIssueAssist({
      action: 'summarize',
      provider: 'openai',
      apiKey: 'sk-test',
      issue: BASE_ISSUE,
    });
    expect(res.text).toBe('Auth broken, needs investigation.');
  });

  it('suggest_labels — parses JSON labels array', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ labels: ['frontend', 'bug', 'auth'] }),
            },
          },
        ],
      }),
    }) as any;

    const res = await runIssueAssist({
      action: 'suggest_labels',
      provider: 'openai',
      apiKey: 'sk-test',
      issue: BASE_ISSUE,
    });
    expect(res.labels).toEqual(['frontend', 'bug', 'auth']);
  });

  it('wraps provider HTTP failure as AiDraftError', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limit',
    }) as any;

    await expect(
      runIssueAssist({
        action: 'summarize',
        provider: 'openai',
        apiKey: 'sk-test',
        issue: BASE_ISSUE,
      })
    ).rejects.toMatchObject({ code: 'provider_error' });
  });
});
