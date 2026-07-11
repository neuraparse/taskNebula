import {
  attachIssueDocument,
  detachIssueDocument,
  listIssueDocuments,
  searchDocumentPages,
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

describe('issue docs API', () => {
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

  it('lists linked issue documents', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        docs: [
          {
            linkId: 'link_1',
            id: 'page_1',
            spaceId: 'space_1',
            title: 'Spec',
            icon: '🧩',
            projectId: 'project_1',
            updatedAt: '2026-06-28T10:00:00.000Z',
          },
          { id: 'missing-title', spaceId: 'space_1' },
        ],
      }),
    );

    await expect(listIssueDocuments('issue_1')).resolves.toEqual([
      expect.objectContaining({
        linkId: 'link_1',
        id: 'page_1',
        spaceId: 'space_1',
        title: 'Spec',
        icon: '🧩',
        projectId: 'project_1',
      }),
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/docs',
    );
  });

  it('attaches, creates, and detaches issue documents', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(201, { id: 'link_1', pageId: 'page_1' }))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          page: {
            id: 'page_2',
            spaceId: 'space_1',
            title: 'TASK-1 Spec',
            contentText: 'Spec body',
          },
          link: { id: 'link_2', pageId: 'page_2' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await attachIssueDocument('issue_1', { pageId: 'page_1' });
    await expect(
      attachIssueDocument('issue_1', { createNew: true, title: 'TASK-1 Spec' }),
    ).resolves.toEqual(
      expect.objectContaining({
        page: expect.objectContaining({ id: 'page_2', title: 'TASK-1 Spec' }),
        link: { id: 'link_2', pageId: 'page_2' },
      }),
    );
    await detachIssueDocument('issue_1', 'page_1');

    const [attachUrl, attachInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(attachUrl).toBe('https://tasks.example.com/api/issues/issue_1/docs');
    expect(attachInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(attachInit?.body))).toEqual({ pageId: 'page_1' });

    const [, createInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(JSON.parse(String(createInit?.body))).toEqual({
      createNew: true,
      title: 'TASK-1 Spec',
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[2]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/docs?pageId=page_1',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('searches documents with organization and project scope', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { results: [] }));

    await searchDocumentPages('spec', { organizationId: 'org_1', projectId: 'project_1' });

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/docs/search?q=spec&limit=30&organizationId=org_1&projectId=project_1',
    );
  });
});
