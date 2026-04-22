/**
 * @jest-environment node
 */

import { draftIssuesMulti } from '../draft-issues-multi';
import { AiDraftError } from '../draft-issue';

describe('draftIssuesMulti (native heuristic)', () => {
  it('splits a bulleted prompt into separate drafts', async () => {
    const drafts = await draftIssuesMulti({
      prompt: `- add offline mode
- fix push notifications
- update onboarding copy`,
      projectName: 'P',
      projectKey: 'P',
      provider: 'native',
      apiKey: null,
      maxCount: 5,
    });
    expect(drafts.length).toBe(3);
    expect(drafts[0]!.title).toContain('offline');
    expect(drafts[1]!.title).toContain('push');
    expect(drafts[2]!.title).toContain('onboarding');
  });

  it('returns one draft when prompt has no list markers', async () => {
    const drafts = await draftIssuesMulti({
      prompt: 'Single issue about the sidebar being too narrow on iPad.',
      projectName: 'P',
      projectKey: 'P',
      provider: 'native',
      apiKey: null,
    });
    expect(drafts.length).toBe(1);
    expect(drafts[0]!.type).toBe('task');
  });

  it('respects maxCount', async () => {
    const drafts = await draftIssuesMulti({
      prompt: '- a\n- b\n- c\n- d\n- e\n- f\n- g',
      projectName: 'P',
      projectKey: 'P',
      provider: 'native',
      apiKey: null,
      maxCount: 3,
    });
    expect(drafts.length).toBe(3);
  });
});

describe('draftIssuesMulti (OpenAI adapter)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws missing_credential when no apiKey', async () => {
    await expect(
      draftIssuesMulti({
        prompt: 'x',
        projectName: 'P',
        projectKey: 'P',
        provider: 'openai',
        apiKey: null,
      })
    ).rejects.toMatchObject({ code: 'missing_credential' });
  });

  it('parses a {drafts: [...]} JSON response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                drafts: [
                  {
                    type: 'bug',
                    title: 'Fix login',
                    description: null,
                    priority: 'high',
                    labels: ['auth'],
                    estimate: null,
                  },
                  {
                    type: 'task',
                    title: 'Add signup tracking',
                    description: null,
                    priority: 'medium',
                    labels: [],
                    estimate: null,
                  },
                ],
              }),
            },
          },
        ],
      }),
    }) as any;

    const drafts = await draftIssuesMulti({
      prompt: 'two tickets',
      projectName: 'P',
      projectKey: 'P',
      provider: 'openai',
      apiKey: 'sk-test',
      maxCount: 10,
    });
    expect(drafts.length).toBe(2);
    expect(drafts[0]!.type).toBe('bug');
    expect(drafts[1]!.title).toBe('Add signup tracking');
  });

  it('rejects schema-invalid output', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: JSON.stringify({ drafts: [{ type: 'nonsense' }] }) } },
        ],
      }),
    }) as any;

    await expect(
      draftIssuesMulti({
        prompt: 'x',
        projectName: 'P',
        projectKey: 'P',
        provider: 'openai',
        apiKey: 'sk-test',
      })
    ).rejects.toBeInstanceOf(AiDraftError);
  });
});
