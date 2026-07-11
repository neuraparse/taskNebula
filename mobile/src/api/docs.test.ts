import {
  createDocumentPage,
  deleteDocumentAttachment,
  documentTextToContentJson,
  getPublicDocumentPage,
  getDocumentTree,
  listDocumentAttachments,
  listDocumentPages,
  listDocumentRevisions,
  listDocumentSpaces,
  restoreDocumentRevision,
  uploadDocumentAttachment,
  updateDocumentShare,
} from './endpoints';
import { configureApi } from './client';

const originalFetch = globalThis.fetch;
const formDataGlobal = globalThis as typeof globalThis & { FormData: typeof FormData };
const originalFormData = formDataGlobal.FormData;

class TestFormData {
  fields: Array<{ name: string; value: unknown }> = [];

  append(name: string, value: unknown) {
    this.fields.push({ name, value });
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('docs API', () => {
  beforeAll(() => {
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
    formDataGlobal.FormData = TestFormData as unknown as typeof FormData;
  });

  beforeEach(() => {
    jest.mocked(globalThis.fetch).mockReset();
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    formDataGlobal.FormData = originalFormData;
  });

  it('normalizes writable document spaces', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        spaces: [
          {
            id: 'space_1',
            organizationId: 'org_1',
            name: 'Engineering',
            scope: 'organization',
            permissions: { canCreate: true },
          },
          { id: 'missing-name' },
        ],
      }),
    );

    await expect(listDocumentSpaces()).resolves.toEqual([
      expect.objectContaining({
        id: 'space_1',
        organizationId: 'org_1',
        name: 'Engineering',
        permissions: { canCreate: true },
      }),
    ]);
  });

  it('loads project-scoped document spaces and pages', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          spaces: [
            {
              id: 'space_project',
              organizationId: 'org_1',
              projectId: 'project_1',
              name: 'MOB Docs',
              scope: 'project',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          space: {
            id: 'space_project',
            organizationId: 'org_1',
            projectId: 'project_1',
            name: 'MOB Docs',
            scope: 'project',
          },
          permissions: { canCreate: true, canEdit: true },
          pages: [
            {
              id: 'page_1',
              spaceId: 'space_project',
              projectId: 'project_1',
              title: 'Mobile runbook',
              slug: 'mobile-runbook',
            },
          ],
        }),
      );

    await expect(listDocumentSpaces({ projectId: 'project_1' })).resolves.toEqual([
      expect.objectContaining({
        id: 'space_project',
        projectId: 'project_1',
        scope: 'project',
      }),
    ]);
    await expect(listDocumentPages(null, { projectId: 'project_1' })).resolves.toEqual({
      space: expect.objectContaining({
        id: 'space_project',
        projectId: 'project_1',
      }),
      permissions: { canCreate: true, canEdit: true },
      pages: [
        expect.objectContaining({
          id: 'page_1',
          projectId: 'project_1',
          title: 'Mobile runbook',
        }),
      ],
    });

    const [spacesUrl] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [pagesUrl] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(spacesUrl).toBe('https://tasks.example.com/api/docs/spaces?projectId=project_1');
    expect(pagesUrl).toBe('https://tasks.example.com/api/docs/pages?projectId=project_1');
  });

  it('creates a document page with content JSON generated from draft text', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(201, {
        id: 'page_1',
        spaceId: 'space_1',
        title: 'Release checklist',
        contentText: 'Ship it',
        backlinks: [],
        relatedIssues: [],
      }),
    );

    const contentJson = documentTextToContentJson('Ship it\\n\\nWatch metrics');
    await expect(
      createDocumentPage({
        spaceId: 'space_1',
        title: 'Release checklist',
        contentJson,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'page_1',
        spaceId: 'space_1',
        title: 'Release checklist',
      }),
    );

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/docs/pages');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      spaceId: 'space_1',
      title: 'Release checklist',
      contentJson,
    });
  });

  it('updates public document sharing settings', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'page_1',
        spaceId: 'space_1',
        title: 'Release checklist',
        contentText: 'Ship it',
        backlinks: [],
        relatedIssues: [],
        share: {
          canManagePublic: true,
          internalPath: '/docs?pageId=page_1&spaceId=space_1',
          public: {
            enabled: true,
            urlPath: '/share/pub_1',
            allowSearchIndexing: false,
            includeAttachments: true,
            publishedAt: '2026-06-28T10:00:00.000Z',
          },
        },
      }),
    );

    await expect(
      updateDocumentShare('page_1', {
        enablePublic: true,
        allowSearchIndexing: false,
        includeAttachments: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'page_1',
        share: expect.objectContaining({
          public: expect.objectContaining({
            enabled: true,
            urlPath: '/share/pub_1',
            includeAttachments: true,
          }),
        }),
      }),
    );

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/docs/pages/page_1/share');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({
      enablePublic: true,
      allowSearchIndexing: false,
      includeAttachments: true,
    });
  });

  it('loads document tree nodes with nested children', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        currentPageId: 'page_1',
        space: {
          id: 'space_1',
          organizationId: 'org_1',
          name: 'Engineering',
          scope: 'organization',
        },
        tree: [
          {
            id: 'page_1',
            spaceId: 'space_1',
            title: 'Runbook',
            slug: 'runbook',
            updatedAt: '2026-06-28T10:00:00.000Z',
            children: [
              {
                id: 'page_2',
                spaceId: 'space_1',
                parentId: 'page_1',
                title: 'Deploy steps',
                slug: 'deploy-steps',
                excerpt: 'Deployment checklist',
                updatedAt: '2026-06-28T11:00:00.000Z',
                children: [],
              },
              { id: 'broken-child' },
            ],
          },
        ],
      }),
    );

    await expect(getDocumentTree('page_1')).resolves.toEqual({
      currentPageId: 'page_1',
      space: expect.objectContaining({ id: 'space_1', name: 'Engineering' }),
      tree: [
        expect.objectContaining({
          id: 'page_1',
          title: 'Runbook',
          children: [
            expect.objectContaining({
              id: 'page_2',
              parentId: 'page_1',
              title: 'Deploy steps',
              children: [],
            }),
          ],
        }),
      ],
    });

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/docs/pages/page_1/tree');
  });

  it('lists and restores document revisions', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          revisions: [
            {
              id: 'rev_2',
              pageId: 'page_1',
              revision: '2',
              title: 'Release checklist',
              excerpt: 'Updated deploy steps',
              changeSummary: 'Clarified deploy steps',
              createdAt: '2026-06-28T11:00:00.000Z',
              createdBy: 'user_1',
              author: {
                id: 'user_1',
                name: 'Ada Lovelace',
                email: 'ada@example.com',
                image: null,
              },
            },
            { id: 'broken', title: 'Missing page' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'page_1',
          spaceId: 'space_1',
          title: 'Release checklist',
          currentRevision: 3,
          contentText: 'Restored deploy steps',
          backlinks: [],
          relatedIssues: [],
        }),
      );

    await expect(listDocumentRevisions('page_1')).resolves.toEqual([
      expect.objectContaining({
        id: 'rev_2',
        pageId: 'page_1',
        revision: 2,
        title: 'Release checklist',
        changeSummary: 'Clarified deploy steps',
        author: expect.objectContaining({ id: 'user_1', name: 'Ada Lovelace' }),
      }),
    ]);

    await expect(restoreDocumentRevision('page_1', { revisionId: 'rev_2' })).resolves.toEqual(
      expect.objectContaining({
        id: 'page_1',
        currentRevision: 3,
        contentText: 'Restored deploy steps',
      }),
    );

    const [listUrl] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [restoreUrl, restoreInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(listUrl).toBe('https://tasks.example.com/api/docs/pages/page_1/revisions');
    expect(restoreUrl).toBe('https://tasks.example.com/api/docs/pages/page_1/restore');
    expect(restoreInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(restoreInit?.body))).toEqual({ revisionId: 'rev_2' });
  });

  it('loads public shared documents by share token', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        page: {
          id: 'page_public',
          title: 'Public runbook',
          slug: 'public-runbook',
          excerpt: 'Read-only summary',
          updatedAt: '2026-06-28T10:00:00.000Z',
          publishedAt: '2026-06-28T09:00:00.000Z',
          allowSearchIndexing: false,
          includeAttachments: true,
          contentJson: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ship it' }] }],
          },
          attachments: [
            {
              id: 'att_1',
              fileName: 'brief.pdf',
              fileSize: '2048',
              mimeType: 'application/pdf',
              publicUrl: '/api/public/docs/tok/assets/att_1',
            },
            { id: 'broken' },
          ],
        },
      }),
    );

    await expect(getPublicDocumentPage('tok')).resolves.toEqual(
      expect.objectContaining({
        id: 'page_public',
        title: 'Public runbook',
        allowSearchIndexing: false,
        includeAttachments: true,
        attachments: [
          {
            id: 'att_1',
            fileName: 'brief.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
            publicUrl: '/api/public/docs/tok/assets/att_1',
          },
        ],
      }),
    );

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/public/docs/tok');
  });

  it('lists, uploads, and deletes document attachments', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          attachments: [
            {
              id: 'doc_att_1',
              pageId: 'page_1',
              fileName: 'brief.pdf',
              fileSize: '8192',
              mimeType: 'application/pdf',
              filePath: '/uploads/doc_att_1.pdf',
              uploadedById: 'user_1',
              createdAt: '2026-06-28T10:00:00.000Z',
            },
            { id: 'broken', pageId: 'page_1', fileName: 'broken.pdf', fileSize: 1 },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          attachment: {
            id: 'doc_att_2',
            pageId: 'page_1',
            fileName: 'diagram.png',
            fileSize: 4096,
            mimeType: 'image/png',
            filePath: '/uploads/doc_att_2.png',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await expect(listDocumentAttachments('page_1')).resolves.toEqual([
      {
        id: 'doc_att_1',
        pageId: 'page_1',
        fileName: 'brief.pdf',
        fileSize: 8192,
        mimeType: 'application/pdf',
        filePath: '/uploads/doc_att_1.pdf',
        uploadedById: 'user_1',
        createdAt: '2026-06-28T10:00:00.000Z',
      },
    ]);

    await expect(
      uploadDocumentAttachment('page_1', {
        uri: 'content://documents/diagram.png',
        name: 'diagram.png',
        type: 'image/png',
        size: 4096,
      }),
    ).resolves.toMatchObject({
      id: 'doc_att_2',
      fileName: 'diagram.png',
      fileSize: 4096,
    });

    await expect(deleteDocumentAttachment('page_1', 'doc_att_2')).resolves.toEqual({
      success: true,
    });

    const [listUrl] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [uploadUrl, uploadInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    const [deleteUrl, deleteInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];
    expect(listUrl).toBe('https://tasks.example.com/api/docs/pages/page_1/attachments');
    expect(uploadUrl).toBe('https://tasks.example.com/api/docs/pages/page_1/attachments');
    expect(uploadInit).toMatchObject({ method: 'POST' });
    expect((uploadInit?.headers as Headers).get('Content-Type')).toBeNull();
    expect(uploadInit?.body).toBeInstanceOf(TestFormData);
    expect((uploadInit?.body as unknown as TestFormData).fields).toEqual([
      {
        name: 'file',
        value: {
          uri: 'content://documents/diagram.png',
          name: 'diagram.png',
          type: 'image/png',
        },
      },
    ]);
    expect(deleteUrl).toBe(
      'https://tasks.example.com/api/docs/pages/page_1/attachments?attachmentId=doc_att_2',
    );
    expect(deleteInit).toMatchObject({ method: 'DELETE' });
  });
});
