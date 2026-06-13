const authMock = jest.fn();
const publishEventMock = jest.fn();
const canCommentOnIssueMock = jest.fn();
const getCommentByIdMock = jest.fn();
const updateCommentReactionsMock = jest.fn();

const afterCallbacks: Array<() => Promise<void> | void> = [];
async function flushAfter() {
  while (afterCallbacks.length > 0) {
    const cb = afterCallbacks.shift();
    if (cb) await cb();
  }
}

class MockNextRequest {
  private readonly bodyValue: string;
  readonly nextUrl: URL;

  constructor(
    public readonly url: string,
    private readonly init?: { method?: string; headers?: Record<string, string>; body?: string }
  ) {
    this.nextUrl = new URL(url);
    this.bodyValue = init?.body || '';
  }

  get method() {
    return this.init?.method || 'GET';
  }

  async json() {
    return JSON.parse(this.bodyValue || '{}');
  }
}

class MockNextResponse {
  constructor(
    private readonly payload: unknown,
    init?: { status?: number }
  ) {
    this.status = init?.status || 200;
  }

  status: number;

  async json() {
    return this.payload;
  }

  static json(payload: unknown, init?: { status?: number }) {
    return new MockNextResponse(payload, init);
  }
}

jest.mock('next/server', () => ({
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse,
  after: (cb: () => Promise<void> | void) => {
    afterCallbacks.push(cb);
  },
}));

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

jest.mock('@/lib/realtime/events', () => ({
  publishEvent: (...args: unknown[]) => publishEventMock(...args),
}));

jest.mock('@/lib/auth/access-control', () => ({
  canCommentOnIssue: (...args: unknown[]) => canCommentOnIssueMock(...args),
}));

jest.mock('@tasknebula/db', () => ({
  getCommentById: (...args: unknown[]) => getCommentByIdMock(...args),
  updateCommentReactions: (...args: unknown[]) => updateCommentReactionsMock(...args),
}));

const issue = { id: 'iss_1', projectId: 'proj_1', organizationId: 'org_1' };
const baseComment = {
  id: 'com_1',
  issueId: 'iss_1',
  parentId: null,
  content: 'hello',
  mentions: [],
  reactions: [],
  isInternal: 'false',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 'user_2',
  updatedBy: 'user_2',
};

const routeParams = { params: Promise.resolve({ issueId: 'iss_1', commentId: 'com_1' }) };

function makeRequest(body: unknown) {
  return new MockNextRequest('http://localhost:3000/api/issues/iss_1/comments/com_1/reactions', {
    method: 'POST',
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

describe('POST /api/issues/[issueId]/comments/[commentId]/reactions', () => {
  let POST: typeof import('./route').POST;

  beforeAll(async () => {
    ({ POST } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    afterCallbacks.length = 0;
    authMock.mockResolvedValue({ user: { id: 'user_1' } });
    canCommentOnIssueMock.mockResolvedValue({ allowed: true, issue });
    getCommentByIdMock.mockResolvedValue({ ...baseComment });
  });

  it('returns 401 when no session', async () => {
    authMock.mockResolvedValue(null);
    const response = await POST(makeRequest({ emoji: '👍' }), routeParams);
    expect(response.status).toBe(401);
  });

  it('returns 400 for an emoji outside the allowlist', async () => {
    const response = await POST(makeRequest({ emoji: '💩' }), routeParams);
    expect(response.status).toBe(400);
    expect(updateCommentReactionsMock).not.toHaveBeenCalled();
  });

  it('returns 400 when emoji is missing', async () => {
    const response = await POST(makeRequest({}), routeParams);
    expect(response.status).toBe(400);
  });

  it('returns 404 when issue not found', async () => {
    canCommentOnIssueMock.mockResolvedValue({ allowed: false, issue: null });
    const response = await POST(makeRequest({ emoji: '👍' }), routeParams);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Issue not found' });
  });

  it('returns 403 when caller may not comment on the issue', async () => {
    canCommentOnIssueMock.mockResolvedValue({ allowed: false, issue });
    const response = await POST(makeRequest({ emoji: '👍' }), routeParams);
    expect(response.status).toBe(403);
  });

  it('returns 404 when the comment belongs to a different issue (cross-issue probe)', async () => {
    getCommentByIdMock.mockResolvedValue({ ...baseComment, issueId: 'iss_other' });
    const response = await POST(makeRequest({ emoji: '👍' }), routeParams);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Comment not found' });
    expect(updateCommentReactionsMock).not.toHaveBeenCalled();
  });

  it('adds a reaction when the user has not reacted with that emoji', async () => {
    const existing = { emoji: '🚀', userId: 'user_2', createdAt: '2026-01-01T00:00:00.000Z' };
    getCommentByIdMock.mockResolvedValue({ ...baseComment, reactions: [existing] });
    updateCommentReactionsMock.mockImplementation(async (_id: string, reactions: unknown[]) => ({
      ...baseComment,
      reactions,
    }));

    const response = await POST(makeRequest({ emoji: '👍' }), routeParams);

    expect(response.status).toBe(200);
    expect(updateCommentReactionsMock).toHaveBeenCalledWith('com_1', [
      existing,
      expect.objectContaining({ emoji: '👍', userId: 'user_1', createdAt: expect.any(String) }),
    ]);
    const payload = (await response.json()) as {
      commentId: string;
      reacted: boolean;
      reactions: Array<{ emoji: string; userId: string }>;
    };
    expect(payload.commentId).toBe('com_1');
    expect(payload.reacted).toBe(true);
    expect(payload.reactions).toHaveLength(2);

    await flushAfter();
    expect(publishEventMock).toHaveBeenCalledWith('issue.commented', 'user_1', {
      issueId: 'iss_1',
      projectId: 'proj_1',
      organizationId: 'org_1',
    });
  });

  it('removes the reaction when the user already reacted with that emoji', async () => {
    const mine = { emoji: '👍', userId: 'user_1', createdAt: '2026-01-01T00:00:00.000Z' };
    const theirs = { emoji: '👍', userId: 'user_2', createdAt: '2026-01-01T00:00:00.000Z' };
    getCommentByIdMock.mockResolvedValue({ ...baseComment, reactions: [mine, theirs] });
    updateCommentReactionsMock.mockImplementation(async (_id: string, reactions: unknown[]) => ({
      ...baseComment,
      reactions,
    }));

    const response = await POST(makeRequest({ emoji: '👍' }), routeParams);

    expect(response.status).toBe(200);
    // Only the caller's entry is removed; other users' reactions survive.
    expect(updateCommentReactionsMock).toHaveBeenCalledWith('com_1', [theirs]);
    const payload = (await response.json()) as { reacted: boolean; reactions: unknown[] };
    expect(payload.reacted).toBe(false);
    expect(payload.reactions).toEqual([theirs]);
  });

  it('tolerates malformed reactions JSONB by treating it as empty', async () => {
    getCommentByIdMock.mockResolvedValue({ ...baseComment, reactions: { bogus: true } });
    updateCommentReactionsMock.mockImplementation(async (_id: string, reactions: unknown[]) => ({
      ...baseComment,
      reactions,
    }));

    const response = await POST(makeRequest({ emoji: '👀' }), routeParams);

    expect(response.status).toBe(200);
    expect(updateCommentReactionsMock).toHaveBeenCalledWith('com_1', [
      expect.objectContaining({ emoji: '👀', userId: 'user_1' }),
    ]);
  });
});
