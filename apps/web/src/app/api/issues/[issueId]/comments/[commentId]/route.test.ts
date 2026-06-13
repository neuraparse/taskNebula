const authMock = jest.fn();
const publishEventMock = jest.fn();
const canCommentOnIssueMock = jest.fn();
const canReadIssueMock = jest.fn();
const canManageProjectMock = jest.fn();
const getCommentByIdMock = jest.fn();
const updateCommentMock = jest.fn();
const deleteCommentMock = jest.fn();
const hasCommentRepliesMock = jest.fn();
const getProjectByIdMock = jest.fn();
const createAuditLogMock = jest.fn();

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
  canReadIssue: (...args: unknown[]) => canReadIssueMock(...args),
  canManageProject: (...args: unknown[]) => canManageProjectMock(...args),
}));

jest.mock('@tasknebula/db', () => ({
  getCommentById: (...args: unknown[]) => getCommentByIdMock(...args),
  updateComment: (...args: unknown[]) => updateCommentMock(...args),
  deleteComment: (...args: unknown[]) => deleteCommentMock(...args),
  hasCommentReplies: (...args: unknown[]) => hasCommentRepliesMock(...args),
  getProjectById: (...args: unknown[]) => getProjectByIdMock(...args),
  createAuditLog: (...args: unknown[]) => createAuditLogMock(...args),
}));

const issue = { id: 'iss_1', projectId: 'proj_1', organizationId: 'org_1' };
const project = { id: 'proj_1', organizationId: 'org_1' };
const baseComment = {
  id: 'com_1',
  issueId: 'iss_1',
  parentId: null,
  content: 'original',
  mentions: [],
  reactions: [],
  isInternal: 'false',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 'user_1',
  updatedBy: 'user_1',
};

const routeParams = { params: Promise.resolve({ issueId: 'iss_1', commentId: 'com_1' }) };

function makePatchRequest(body: unknown) {
  return new MockNextRequest('http://localhost:3000/api/issues/iss_1/comments/com_1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

function makeDeleteRequest() {
  return new MockNextRequest('http://localhost:3000/api/issues/iss_1/comments/com_1', {
    method: 'DELETE',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

describe('/api/issues/[issueId]/comments/[commentId] route', () => {
  let PATCH: typeof import('./route').PATCH;
  let DELETE: typeof import('./route').DELETE;

  beforeAll(async () => {
    ({ PATCH, DELETE } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    afterCallbacks.length = 0;
    authMock.mockResolvedValue({ user: { id: 'user_1' } });
    canCommentOnIssueMock.mockResolvedValue({ allowed: true, issue });
    canReadIssueMock.mockResolvedValue({ allowed: true, issue });
    canManageProjectMock.mockResolvedValue(false);
    getProjectByIdMock.mockResolvedValue(project);
    getCommentByIdMock.mockResolvedValue({ ...baseComment });
    hasCommentRepliesMock.mockResolvedValue(false);
  });

  describe('PATCH', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await PATCH(makePatchRequest({ content: 'edited' }), routeParams);
      expect(response.status).toBe(401);
    });

    it('returns 400 when neither content nor mentions is provided', async () => {
      const response = await PATCH(makePatchRequest({}), routeParams);
      expect(response.status).toBe(400);
    });

    it('returns 404 when issue not found', async () => {
      canCommentOnIssueMock.mockResolvedValue({ allowed: false, issue: null });
      const response = await PATCH(makePatchRequest({ content: 'edited' }), routeParams);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Issue not found' });
    });

    it('returns 403 when caller may not comment on the issue', async () => {
      canCommentOnIssueMock.mockResolvedValue({ allowed: false, issue });
      const response = await PATCH(makePatchRequest({ content: 'edited' }), routeParams);
      expect(response.status).toBe(403);
    });

    it('returns 404 when comment not found', async () => {
      getCommentByIdMock.mockResolvedValue(null);
      const response = await PATCH(makePatchRequest({ content: 'edited' }), routeParams);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Comment not found' });
    });

    it('returns 404 when the comment belongs to a different issue (cross-issue probe)', async () => {
      getCommentByIdMock.mockResolvedValue({ ...baseComment, issueId: 'iss_other' });
      const response = await PATCH(makePatchRequest({ content: 'edited' }), routeParams);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Comment not found' });
      expect(updateCommentMock).not.toHaveBeenCalled();
    });

    it('returns 403 when caller is neither author nor project admin', async () => {
      getCommentByIdMock.mockResolvedValue({ ...baseComment, createdBy: 'user_other' });
      canManageProjectMock.mockResolvedValue(false);
      const response = await PATCH(makePatchRequest({ content: 'edited' }), routeParams);
      expect(response.status).toBe(403);
      expect(updateCommentMock).not.toHaveBeenCalled();
    });

    it('lets the author edit content + mentions, stamps updatedBy, derives edited flag', async () => {
      updateCommentMock.mockResolvedValue({
        ...baseComment,
        content: 'edited',
        mentions: ['user_2'],
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedBy: 'user_1',
      });

      const response = await PATCH(
        makePatchRequest({ content: 'edited', mentions: ['user_2'] }),
        routeParams
      );

      expect(response.status).toBe(200);
      expect(updateCommentMock).toHaveBeenCalledWith('com_1', {
        content: 'edited',
        mentions: ['user_2'],
        updatedBy: 'user_1',
      });
      const payload = (await response.json()) as { content: string; edited: boolean };
      expect(payload.content).toBe('edited');
      expect(payload.edited).toBe(true);

      await flushAfter();
      expect(createAuditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_1',
          organizationId: 'org_1',
          action: 'issue.commented',
          resourceType: 'issue_comment',
          resourceId: 'com_1',
          metadata: { commentId: 'com_1', operation: 'comment_updated' },
        })
      );
      expect(publishEventMock).toHaveBeenCalledWith('issue.commented', 'user_1', {
        issueId: 'iss_1',
        projectId: 'proj_1',
        organizationId: 'org_1',
      });
    });

    it('lets a project admin edit someone else’s comment', async () => {
      getCommentByIdMock.mockResolvedValue({ ...baseComment, createdBy: 'user_other' });
      canManageProjectMock.mockResolvedValue(true);
      updateCommentMock.mockResolvedValue({
        ...baseComment,
        createdBy: 'user_other',
        content: 'moderated',
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedBy: 'user_1',
      });

      const response = await PATCH(makePatchRequest({ content: 'moderated' }), routeParams);

      expect(response.status).toBe(200);
      expect(canManageProjectMock).toHaveBeenCalledWith('user_1', project);
      expect(updateCommentMock).toHaveBeenCalledWith('com_1', {
        content: 'moderated',
        updatedBy: 'user_1',
      });
    });
  });

  describe('DELETE', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await DELETE(makeDeleteRequest(), routeParams);
      expect(response.status).toBe(401);
    });

    it('returns 404 when issue not found', async () => {
      canReadIssueMock.mockResolvedValue({ allowed: false, issue: null });
      const response = await DELETE(makeDeleteRequest(), routeParams);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Issue not found' });
    });

    it('returns 404 when the comment belongs to a different issue (cross-issue probe)', async () => {
      getCommentByIdMock.mockResolvedValue({ ...baseComment, issueId: 'iss_other' });
      const response = await DELETE(makeDeleteRequest(), routeParams);
      expect(response.status).toBe(404);
      expect(deleteCommentMock).not.toHaveBeenCalled();
    });

    it('returns 403 when caller is neither author nor project admin', async () => {
      getCommentByIdMock.mockResolvedValue({ ...baseComment, createdBy: 'user_other' });
      canManageProjectMock.mockResolvedValue(false);
      const response = await DELETE(makeDeleteRequest(), routeParams);
      expect(response.status).toBe(403);
      expect(deleteCommentMock).not.toHaveBeenCalled();
    });

    it('returns 409 when the comment has threaded replies', async () => {
      hasCommentRepliesMock.mockResolvedValue(true);
      const response = await DELETE(makeDeleteRequest(), routeParams);
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: 'Cannot delete a comment that has replies',
      });
      expect(deleteCommentMock).not.toHaveBeenCalled();
    });

    it('deletes, audit-logs and publishes on the happy path', async () => {
      deleteCommentMock.mockResolvedValue({ id: 'com_1' });

      const response = await DELETE(makeDeleteRequest(), routeParams);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true, id: 'com_1' });
      expect(deleteCommentMock).toHaveBeenCalledWith('com_1');

      await flushAfter();
      expect(createAuditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'issue.commented',
          resourceType: 'issue_comment',
          resourceId: 'com_1',
          organizationId: 'org_1',
          metadata: { commentId: 'com_1', operation: 'comment_deleted' },
        })
      );
      expect(publishEventMock).toHaveBeenCalledWith('issue.commented', 'user_1', {
        issueId: 'iss_1',
        projectId: 'proj_1',
        organizationId: 'org_1',
      });
    });

    it('lets a project admin delete someone else’s comment', async () => {
      getCommentByIdMock.mockResolvedValue({ ...baseComment, createdBy: 'user_other' });
      canManageProjectMock.mockResolvedValue(true);
      deleteCommentMock.mockResolvedValue({ id: 'com_1' });

      const response = await DELETE(makeDeleteRequest(), routeParams);

      expect(response.status).toBe(200);
      expect(canManageProjectMock).toHaveBeenCalledWith('user_1', project);
    });
  });
});
