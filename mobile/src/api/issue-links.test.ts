import { configureApi } from './client';
import { createIssueLink, deleteIssueLink, listIssueLinks } from './endpoints';

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

describe('issue links API', () => {
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

  it('lists and normalizes inbound and outbound issue links', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        outbound: [
          {
            id: 'link_1',
            type: 'blocks',
            direction: 'outbound',
            createdAt: '2026-06-28T10:00:00.000Z',
            issue: {
              id: 'issue_2',
              key: 'API-2',
              title: 'Ship dependency',
              statusId: 'status_1',
              type: 'task',
              priority: 'high',
            },
          },
          { id: 'missing-issue', type: 'blocks', direction: 'outbound' },
        ],
        inbound: [
          {
            id: 'link_2',
            type: 'duplicates',
            direction: 'inbound',
            issue: {
              id: 'issue_3',
              key: 'API-3',
              title: 'Duplicate report',
              priority: 'low',
            },
          },
        ],
      }),
    );

    await expect(listIssueLinks('issue_1')).resolves.toEqual({
      outbound: [
        {
          id: 'link_1',
          type: 'blocks',
          direction: 'outbound',
          createdAt: '2026-06-28T10:00:00.000Z',
          issue: {
            id: 'issue_2',
            key: 'API-2',
            title: 'Ship dependency',
            statusId: 'status_1',
            type: 'task',
            priority: 'high',
          },
        },
      ],
      inbound: [
        {
          id: 'link_2',
          type: 'duplicates',
          direction: 'inbound',
          issue: {
            id: 'issue_3',
            key: 'API-3',
            title: 'Duplicate report',
            statusId: null,
            type: null,
            priority: 'low',
          },
        },
      ],
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/links',
    );
  });

  it('creates and deletes issue links through the web API contract', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(201, { id: 'link_1' }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await createIssueLink('issue_1', { targetIssueId: 'issue_2', type: 'relates_to' });
    await deleteIssueLink('issue_1', 'link_1');

    const [createUrl, createInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(createUrl).toBe('https://tasks.example.com/api/issues/issue_1/links');
    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      targetIssueId: 'issue_2',
      type: 'relates_to',
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/links?linkId=link_1',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });
});
