/**
 * @jest-environment node
 *
 * Import run route contract tests.
 */

const authMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();
const executeImportJobMock = jest.fn();
const roleHasPermissionMock = jest.fn();

class MockNextRequest {
  constructor(
    public readonly url: string,
    private readonly init?: { body?: string }
  ) {}

  async json() {
    if (!this.init?.body) throw new Error('missing body');
    return JSON.parse(this.init.body);
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

jest.mock('@/lib/importers/runner', () => ({
  executeImportJob: (...args: unknown[]) => executeImportJobMock(...args),
}));

jest.mock('@tasknebula/db', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  hasPermission: (...args: unknown[]) => roleHasPermissionMock(...args),
  ROLE_DEFAULT_PERMISSIONS: {
    viewer: { canCreateIssues: false },
    developer: { canCreateIssues: true },
  },
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
  },
  importJobs: {
    id: 'importJobs.id',
    workspaceId: 'importJobs.workspaceId',
    source: 'importJobs.source',
    status: 'importJobs.status',
    mapping: 'importJobs.mapping',
    createdBy: 'importJobs.createdBy',
  },
  organizationMembers: {
    organizationId: 'organizationMembers.organizationId',
    userId: 'organizationMembers.userId',
    status: 'organizationMembers.status',
    role: 'organizationMembers.role',
  },
  projectMembers: {
    projectId: 'projectMembers.projectId',
    userId: 'projectMembers.userId',
    role: 'projectMembers.role',
    canCreateIssues: 'projectMembers.canCreateIssues',
  },
  projects: {
    id: 'projects.id',
    organizationId: 'projects.organizationId',
  },
  users: {
    id: 'users.id',
    isSuperAdmin: 'users.isSuperAdmin',
  },
}));

function limitBuilder(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function insertBuilder(capture: (values: unknown) => void) {
  return {
    values: jest.fn((values) => {
      capture(values);
      return {
        returning: jest.fn().mockResolvedValue([{ id: 'job-1', status: 'pending' }]),
      };
    }),
  };
}

describe('POST /api/import/[source]/run', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let POST: typeof import('./route').POST;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ POST } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    roleHasPermissionMock.mockReturnValue(true);
    executeImportJobMock.mockResolvedValue(undefined);
  });

  function callPost(source: string, body: Record<string, unknown>) {
    return POST(
      new NextRequestCtor(`http://localhost/api/import/${source}/run`, {
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ source }) }
    );
  }

  it('stores sanitized mapping but passes upstream credentials to the in-memory runner', async () => {
    dbSelectMock
      .mockReturnValueOnce(limitBuilder([{ id: 'project-1', organizationId: 'org-1' }]))
      .mockReturnValueOnce(limitBuilder([{ isSuperAdmin: false }]))
      .mockReturnValueOnce(limitBuilder([{ role: 'admin' }]));

    let insertedValues: unknown;
    dbInsertMock.mockReturnValue(
      insertBuilder((values) => {
        insertedValues = values;
      })
    );

    const response = await callPost('github', {
      workspaceId: 'org-1',
      projectId: 'project-1',
      mapping: {
        columns: {},
        config: {
          accessToken: 'ghp_secret',
          owner: 'acme',
          repo: 'app',
          perPage: 25,
        },
      },
    });

    expect(response.status).toBe(201);
    expect(insertedValues).toMatchObject({
      workspaceId: 'org-1',
      source: 'github',
      mapping: {
        projectId: 'project-1',
        config: {
          owner: 'acme',
          repo: 'app',
          perPage: 25,
        },
      },
      createdBy: 'user-1',
    });
    expect(JSON.stringify(insertedValues)).not.toContain('ghp_secret');
    expect(executeImportJobMock).toHaveBeenCalledWith('job-1', {
      accessToken: 'ghp_secret',
      owner: 'acme',
      repo: 'app',
      perPage: 25,
    });
  });

  it('rejects a target project outside the requested workspace', async () => {
    dbSelectMock.mockReturnValueOnce(limitBuilder([]));

    const response = await callPost('github', {
      workspaceId: 'org-1',
      projectId: 'other-project',
      mapping: { config: { accessToken: 'ghp_secret', owner: 'acme', repo: 'app' } },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Project not found' });
    expect(dbInsertMock).not.toHaveBeenCalled();
    expect(executeImportJobMock).not.toHaveBeenCalled();
  });
});
