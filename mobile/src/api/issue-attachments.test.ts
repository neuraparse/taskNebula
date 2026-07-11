import { deleteIssueAttachment, listIssueAttachments, uploadIssueAttachment } from './endpoints';
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

describe('issue attachments API', () => {
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

  it('lists and normalizes issue attachments', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        attachments: [
          {
            id: 'att_1',
            issueId: 'issue_1',
            fileName: 'trace.log',
            fileSize: '2048',
            mimeType: 'text/plain',
            filePath: '/uploads/att_1.log',
            uploadedById: 'user_1',
            createdAt: '2026-06-28T10:00:00.000Z',
          },
          { id: 'missing-path', issueId: 'issue_1', fileName: 'broken.txt', fileSize: 1 },
        ],
      }),
    );

    await expect(listIssueAttachments('issue_1')).resolves.toEqual([
      {
        id: 'att_1',
        issueId: 'issue_1',
        fileName: 'trace.log',
        fileSize: 2048,
        mimeType: 'text/plain',
        filePath: '/uploads/att_1.log',
        uploadedById: 'user_1',
        createdAt: '2026-06-28T10:00:00.000Z',
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/attachments',
    );
  });

  it('deletes an issue attachment', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { success: true }));

    await expect(deleteIssueAttachment('issue_1', 'att_1')).resolves.toEqual({ success: true });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1/attachments?attachmentId=att_1');
    expect(init).toMatchObject({ method: 'DELETE' });
  });

  it('uploads an issue attachment as multipart form data', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        attachment: {
          id: 'att_2',
          issueId: 'issue_1',
          fileName: 'screenshot.png',
          fileSize: 4096,
          mimeType: 'image/png',
          filePath: '/uploads/att_2.png',
        },
      }),
    );

    await expect(
      uploadIssueAttachment('issue_1', {
        uri: 'content://documents/screenshot.png',
        name: 'screenshot.png',
        type: 'image/png',
        size: 4096,
      }),
    ).resolves.toMatchObject({
      id: 'att_2',
      fileName: 'screenshot.png',
      fileSize: 4096,
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1/attachments');
    expect(init).toMatchObject({ method: 'POST' });
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get('Content-Type')).toBeNull();
    expect(init?.body).toBeInstanceOf(TestFormData);
    expect((init?.body as unknown as TestFormData).fields).toEqual([
      {
        name: 'file',
        value: {
          uri: 'content://documents/screenshot.png',
          name: 'screenshot.png',
          type: 'image/png',
        },
      },
    ]);
  });
});
