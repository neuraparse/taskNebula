jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private payload: unknown;

    constructor(payload: unknown, init?: ResponseInit) {
      this.payload = payload;
      this.status = init?.status ?? 200;
    }

    async json() {
      return this.payload;
    }

    static json(payload: unknown, init?: ResponseInit) {
      return new MockNextResponse(payload, init);
    }
  }

  return { NextResponse: MockNextResponse };
});

const getPublicDocumentByTokenMock = jest.fn();

jest.mock('@/lib/docs/server', () => ({
  getPublicDocumentByToken: (token: string) => getPublicDocumentByTokenMock(token),
}));

import { GET } from '../route';

describe('GET /api/public/docs/[token]', () => {
  beforeEach(() => {
    getPublicDocumentByTokenMock.mockReset();
  });

  it('returns a public document payload for valid share tokens', async () => {
    getPublicDocumentByTokenMock.mockResolvedValue({
      id: 'page_1',
      title: 'Public runbook',
      slug: 'public-runbook',
      excerpt: 'Read-only summary',
      updatedAt: '2026-06-28T10:00:00.000Z',
      publishedAt: '2026-06-28T09:00:00.000Z',
      allowSearchIndexing: false,
      includeAttachments: true,
      contentJson: { type: 'doc', content: [] },
      attachments: [],
    });

    const response = await GET({} as Request, {
      params: Promise.resolve({ token: 'tok' }),
    });

    await expect(response.json()).resolves.toEqual({
      page: expect.objectContaining({
        id: 'page_1',
        title: 'Public runbook',
      }),
    });
    expect(response.status).toBe(200);
    expect(getPublicDocumentByTokenMock).toHaveBeenCalledWith('tok');
  });

  it('returns 404 for disabled or missing share tokens', async () => {
    getPublicDocumentByTokenMock.mockResolvedValue(null);

    const response = await GET({} as Request, {
      params: Promise.resolve({ token: 'bad' }),
    });

    await expect(response.json()).resolves.toEqual({ error: 'Document not found' });
    expect(response.status).toBe(404);
  });
});
