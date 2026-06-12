const authMock = jest.fn();
const dbSelectMock = jest.fn();
const dbTransactionMock = jest.fn();
const resolveProjectByIdOrKeyMock = jest.fn();
const canReadProjectMock = jest.fn();
const canManageProjectMock = jest.fn();

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

  async text() {
    return this.bodyValue;
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
}));

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

jest.mock('@/lib/projects/server', () => ({
  resolveProjectByIdOrKey: (...args: unknown[]) => resolveProjectByIdOrKeyMock(...args),
}));

jest.mock('@/lib/auth/access-control', () => ({
  canReadProject: (...args: unknown[]) => canReadProjectMock(...args),
  canManageProject: (...args: unknown[]) => canManageProjectMock(...args),
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    transaction: (...args: unknown[]) => dbTransactionMock(...args),
  },
  projectVersions: {
    id: 'projectVersions.id',
    projectId: 'projectVersions.projectId',
    status: 'projectVersions.status',
  },
  issueFixVersions: {
    issueId: 'issueFixVersions.issueId',
    versionId: 'issueFixVersions.versionId',
    organizationId: 'issueFixVersions.organizationId',
  },
  issues: {
    id: 'issues.id',
    resolution: 'issues.resolution',
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  inArray: (left: unknown, right: unknown) => ({ type: 'inArray', left, right }),
  isNull: (value: unknown) => ({ type: 'isNull', value }),
  relations: () => ({}),
}));

function chainable(result: unknown) {
  const chain: {
    from: () => typeof chain;
    where: () => typeof chain;
    innerJoin: () => typeof chain;
    limit: () => Promise<unknown>;
    then: (resolve: (value: unknown) => unknown) => unknown;
  } = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    limit: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
  return chain;
}

interface MockTx {
  select: jest.Mock;
  delete: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
}

function buildTx(options: { openRows?: Array<{ issueId: string }>; updatedVersion: unknown }) {
  const deleteWhereMock = jest.fn().mockResolvedValue(undefined);
  const insertValuesMock = jest.fn().mockReturnValue({
    onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
  });
  const updateSetMock = jest.fn().mockReturnValue({
    where: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([options.updatedVersion]),
    }),
  });

  const tx: MockTx = {
    select: jest.fn().mockReturnValue(chainable(options.openRows ?? [])),
    delete: jest.fn().mockReturnValue({ where: deleteWhereMock }),
    insert: jest.fn().mockReturnValue({ values: insertValuesMock }),
    update: jest.fn().mockReturnValue({ set: updateSetMock }),
  };

  return { tx, deleteWhereMock, insertValuesMock, updateSetMock };
}

const project = { id: 'proj_1', organizationId: 'org_1', key: 'PROJ' };
const version = {
  id: 'ver_1',
  projectId: 'proj_1',
  organizationId: 'org_1',
  name: '1.0.0',
  status: 'unreleased',
  releasedAt: null,
};

function makeRequest(body?: unknown) {
  return new MockNextRequest('http://localhost:3000/api/projects/proj_1/versions/ver_1/release', {
    method: 'POST',
    body: body === undefined ? '' : JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

const routeParams = { params: Promise.resolve({ projectId: 'proj_1', versionId: 'ver_1' }) };

describe('POST /api/projects/[projectId]/versions/[versionId]/release', () => {
  let POST: typeof import('./route').POST;

  beforeAll(async () => {
    ({ POST } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user_1' } });
    resolveProjectByIdOrKeyMock.mockResolvedValue(project);
    canReadProjectMock.mockResolvedValue(true);
    canManageProjectMock.mockResolvedValue(true);
  });

  it('returns 401 when no session', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(makeRequest(), routeParams);

    expect(response.status).toBe(401);
  });

  it('returns 404 when project not found', async () => {
    resolveProjectByIdOrKeyMock.mockResolvedValue(null);

    const response = await POST(makeRequest(), routeParams);

    expect(response.status).toBe(404);
  });

  it('returns 404 (not 403) when caller cannot read the project (cross-org probe)', async () => {
    canReadProjectMock.mockResolvedValue(false);

    const response = await POST(makeRequest(), routeParams);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Project not found' });
  });

  it('returns 403 when caller can read but not manage the project', async () => {
    canManageProjectMock.mockResolvedValue(false);

    const response = await POST(makeRequest(), routeParams);

    expect(response.status).toBe(403);
  });

  it('returns 404 when the version does not belong to the project', async () => {
    dbSelectMock.mockReturnValueOnce(chainable([]));

    const response = await POST(makeRequest(), routeParams);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Version not found' });
  });

  it('returns 400 when the move target equals the version being released', async () => {
    dbSelectMock.mockReturnValueOnce(chainable([version]));

    const response = await POST(makeRequest({ moveOpenIssuesToVersionId: 'ver_1' }), routeParams);

    expect(response.status).toBe(400);
  });

  it('returns 400 when the move target is not a version of the same project', async () => {
    dbSelectMock
      .mockReturnValueOnce(chainable([version])) // version lookup
      .mockReturnValueOnce(chainable([])); // target lookup (scoped to project) misses

    const response = await POST(
      makeRequest({ moveOpenIssuesToVersionId: 'ver_other_org' }),
      routeParams
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Target version not found in this project',
    });
    expect(dbTransactionMock).not.toHaveBeenCalled();
  });

  it('releases the version without moving issues when no body is sent', async () => {
    dbSelectMock.mockReturnValueOnce(chainable([version]));
    const updatedVersion = { ...version, status: 'released' };
    const { tx, deleteWhereMock, insertValuesMock, updateSetMock } = buildTx({
      updatedVersion,
    });
    dbTransactionMock.mockImplementation(async (fn: (tx: MockTx) => unknown) => fn(tx));

    const response = await POST(makeRequest(), routeParams);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      version: updatedVersion,
      movedIssueCount: 0,
    });
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'released', releasedAt: expect.any(Date) })
    );
    expect(deleteWhereMock).not.toHaveBeenCalled();
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it('re-points unresolved issues to the target version inside the transaction', async () => {
    dbSelectMock
      .mockReturnValueOnce(chainable([version])) // version lookup
      .mockReturnValueOnce(chainable([{ id: 'ver_2' }])); // target lookup
    const updatedVersion = { ...version, status: 'released' };
    const { tx, deleteWhereMock, insertValuesMock } = buildTx({
      openRows: [{ issueId: 'iss_1' }, { issueId: 'iss_2' }],
      updatedVersion,
    });
    dbTransactionMock.mockImplementation(async (fn: (tx: MockTx) => unknown) => fn(tx));

    const response = await POST(makeRequest({ moveOpenIssuesToVersionId: 'ver_2' }), routeParams);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      version: updatedVersion,
      movedIssueCount: 2,
    });
    // Old fix-version rows for the unresolved issues are removed...
    expect(deleteWhereMock).toHaveBeenCalledTimes(1);
    // ...and re-created against the target version, stamped with the org id.
    expect(insertValuesMock).toHaveBeenCalledWith([
      { issueId: 'iss_1', versionId: 'ver_2', organizationId: 'org_1' },
      { issueId: 'iss_2', versionId: 'ver_2', organizationId: 'org_1' },
    ]);
  });

  it('does not delete or insert join rows when every linked issue is resolved', async () => {
    dbSelectMock
      .mockReturnValueOnce(chainable([version]))
      .mockReturnValueOnce(chainable([{ id: 'ver_2' }]));
    const updatedVersion = { ...version, status: 'released' };
    const { tx, deleteWhereMock, insertValuesMock } = buildTx({
      openRows: [],
      updatedVersion,
    });
    dbTransactionMock.mockImplementation(async (fn: (tx: MockTx) => unknown) => fn(tx));

    const response = await POST(makeRequest({ moveOpenIssuesToVersionId: 'ver_2' }), routeParams);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      version: updatedVersion,
      movedIssueCount: 0,
    });
    expect(deleteWhereMock).not.toHaveBeenCalled();
    expect(insertValuesMock).not.toHaveBeenCalled();
  });
});
