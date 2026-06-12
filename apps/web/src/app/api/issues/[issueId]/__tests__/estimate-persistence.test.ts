/**
 * Regression: ensure the PATCH /api/issues/[issueId] Zod schema persists
 * `estimateHours`, `estimateSource`, and `descriptionRich` instead of silently
 * stripping them. The TimeTrackingPanel's "Save estimate" button stopped
 * working because the schema was missing these keys — Zod's default behaviour
 * is to drop unknown fields, so the values never reached `updateIssue`.
 */

const authMock = jest.fn();
const getIssueByIdMock = jest.fn();
const updateIssueMock = jest.fn();
const createActivityMock = jest.fn();
const createAuditLogMock = jest.fn();
const deleteIssueMock = jest.fn();
const dbSelectMock = jest.fn();
const publishEventMock = jest.fn();
const notifyIssueEventMock = jest.fn();
const runAutomationsMock = jest.fn();

// --- next/server shim ---------------------------------------------------
// Provide enough of `NextRequest` / `NextResponse` for the route + the
// withValidation wrapper to work without pulling in the real (edge-flavoured)
// next/server module under Jest.
class MockNextRequest {
  private readonly bodyValue: string;
  readonly nextUrl: URL;

  constructor(
    public readonly url: string,
    private readonly init?: { method?: string; headers?: Record<string, string>; body?: string }
  ) {
    this.nextUrl = new URL(url);
    this.bodyValue = init?.body ?? '';
  }

  get method() {
    return this.init?.method || 'GET';
  }

  async json() {
    if (!this.bodyValue) {
      throw new SyntaxError('Unexpected end of JSON input');
    }
    return JSON.parse(this.bodyValue);
  }
}

class MockNextResponse {
  status: number;

  constructor(
    private readonly payload: unknown,
    init?: { status?: number }
  ) {
    this.status = init?.status ?? 200;
  }

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
  // `after` is invoked by the route but we don't care about post-response
  // work here — swallow the callback synchronously.
  after: (_fn: () => unknown) => undefined,
}));

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

jest.mock('@/lib/realtime/events', () => ({
  publishEvent: (...args: unknown[]) => publishEventMock(...args),
}));

jest.mock('@/lib/notifications/send-notification', () => ({
  notifyIssueEvent: (...args: unknown[]) => notifyIssueEventMock(...args),
}));

jest.mock('@/lib/automation/evaluator', () => ({
  runAutomations: (...args: unknown[]) => runAutomationsMock(...args),
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
  },
  getIssueById: (...args: unknown[]) => getIssueByIdMock(...args),
  updateIssue: (...args: unknown[]) => updateIssueMock(...args),
  deleteIssue: (...args: unknown[]) => deleteIssueMock(...args),
  createActivity: (...args: unknown[]) => createActivityMock(...args),
  createAuditLog: (...args: unknown[]) => createAuditLogMock(...args),
  issues: { id: 'issues.id' },
  workflowStatuses: {
    id: 'workflowStatuses.id',
    workflowId: 'workflowStatuses.workflowId',
    category: 'workflowStatuses.category',
    name: 'workflowStatuses.name',
  },
  workflows: {
    id: 'workflows.id',
    organizationId: 'workflows.organizationId',
    isDefault: 'workflows.isDefault',
  },
  projects: { id: 'projects.id', organizationId: 'projects.organizationId' },
  projectMembers: {
    userId: 'projectMembers.userId',
    projectId: 'projectMembers.projectId',
  },
  organizationMembers: {
    userId: 'organizationMembers.userId',
    organizationId: 'organizationMembers.organizationId',
    role: 'organizationMembers.role',
  },
  users: { id: 'users.id', isSuperAdmin: 'users.isSuperAdmin' },
  ROLE_DEFAULT_PERMISSIONS: {
    viewer: {},
    admin: {},
    product_owner: {},
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

// --- chain helpers ------------------------------------------------------
// Mimic the drizzle query-builder shape just enough for the route's
// `.select().from().where().limit()` chains.
function chainable<T>(result: T) {
  const chain: {
    from: () => typeof chain;
    where: () => typeof chain;
    limit: () => Promise<T>;
    orderBy: () => Promise<T>;
    then: (resolve: (v: T) => unknown) => unknown;
  } = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(result),
    orderBy: () => Promise.resolve(result),
    then: (resolve) => resolve(result),
  };
  return chain;
}

const SAMPLE_ISSUE = {
  id: 'issue-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  reporterId: 'user-1',
  assigneeId: null,
  statusId: 'status-1',
  sprintId: null,
  priority: 'medium',
  title: 'Existing title',
  description: 'Existing description',
  key: 'PROJ-1',
};

function makePatch(body: unknown) {
  return new MockNextRequest('http://localhost:3000/api/issues/issue-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/issues/[issueId] — estimate & rich description persistence', () => {
  let PATCH: typeof import('../route').PATCH;

  beforeAll(async () => {
    ({ PATCH } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    getIssueByIdMock.mockResolvedValue(SAMPLE_ISSUE);
    // First db.select call inside checkIssuePermission looks up super admin
    // flag. Returning isSuperAdmin: true short-circuits the rest of the
    // permission path — we don't care about authz in this audit-fix suite.
    dbSelectMock.mockReturnValue(chainable([{ isSuperAdmin: true }]));
    updateIssueMock.mockImplementation((_id: string, data: Record<string, unknown>) =>
      Promise.resolve({ ...SAMPLE_ISSUE, ...data })
    );
  });

  it('persists estimateHours and estimateSource together', async () => {
    const response = await PATCH(
      makePatch({ estimateHours: 4, estimateSource: 'manual' }) as never,
      { params: Promise.resolve({ issueId: 'issue-1' }) }
    );

    expect(response.status).toBe(200);
    expect(updateIssueMock).toHaveBeenCalledTimes(1);
    // Drizzle numeric() columns are string-typed; the route coerces before writing.
    expect(updateIssueMock).toHaveBeenCalledWith(
      'issue-1',
      expect.objectContaining({ estimateHours: '4', estimateSource: 'manual' })
    );
  });

  it('preserves estimateHours: 0 (does not strip a falsy zero)', async () => {
    await PATCH(makePatch({ estimateHours: 0 }) as never, {
      params: Promise.resolve({ issueId: 'issue-1' }),
    });

    expect(updateIssueMock).toHaveBeenCalledTimes(1);
    const [, payload] = updateIssueMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).toHaveProperty('estimateHours', '0');
  });

  it('preserves estimateHours: null', async () => {
    await PATCH(makePatch({ estimateHours: null }) as never, {
      params: Promise.resolve({ issueId: 'issue-1' }),
    });

    expect(updateIssueMock).toHaveBeenCalledTimes(1);
    const [, payload] = updateIssueMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).toHaveProperty('estimateHours', null);
    expect(payload.estimateHours).toBeNull();
  });

  it('omits estimate keys entirely when the caller did not send them', async () => {
    await PATCH(makePatch({ title: 'New title' }) as never, {
      params: Promise.resolve({ issueId: 'issue-1' }),
    });

    expect(updateIssueMock).toHaveBeenCalledTimes(1);
    const [, payload] = updateIssueMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).not.toHaveProperty('estimateHours');
    expect(payload).not.toHaveProperty('estimateSource');
  });

  it('rejects an invalid estimateSource with 400', async () => {
    const response = await PATCH(
      makePatch({ estimateHours: 2, estimateSource: 'guess' }) as never,
      { params: Promise.resolve({ issueId: 'issue-1' }) }
    );

    expect(response.status).toBe(400);
    expect(updateIssueMock).not.toHaveBeenCalled();
  });

  it('flows descriptionRich (ProseMirror JSON) into the update call', async () => {
    const doc = { type: 'doc', content: [] };

    await PATCH(makePatch({ descriptionRich: doc }) as never, {
      params: Promise.resolve({ issueId: 'issue-1' }),
    });

    expect(updateIssueMock).toHaveBeenCalledTimes(1);
    expect(updateIssueMock).toHaveBeenCalledWith(
      'issue-1',
      expect.objectContaining({ descriptionRich: doc })
    );
  });
});
