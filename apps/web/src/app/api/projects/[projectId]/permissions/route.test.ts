const authMock = jest.fn();
const resolveProjectByIdOrKeyMock = jest.fn();
const canReadProjectMock = jest.fn();

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
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: jest.fn(),
  },
  users: {
    id: 'users.id',
    isSuperAdmin: 'users.isSuperAdmin',
  },
  organizationMembers: {
    userId: 'organizationMembers.userId',
    organizationId: 'organizationMembers.organizationId',
    status: 'organizationMembers.status',
    role: 'organizationMembers.role',
  },
  projectMembers: {
    userId: 'projectMembers.userId',
    projectId: 'projectMembers.projectId',
  },
  ROLE_DEFAULT_PERMISSIONS: {
    viewer: {},
  },
  hasPermission: jest.fn(),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

describe('GET /api/projects/[projectId]/permissions', () => {
  let GET: typeof import('./route').GET;

  beforeAll(async () => {
    ({ GET } = await import('./route'));
  });

  beforeEach(() => {
    authMock.mockReset();
    resolveProjectByIdOrKeyMock.mockReset();
    canReadProjectMock.mockReset();
  });

  it('resolves projects through the scoped project resolver and hides unreadable projects', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    const project = { id: 'project-1', organizationId: 'org-1', key: 'TASK' };
    resolveProjectByIdOrKeyMock.mockResolvedValue(project);
    canReadProjectMock.mockResolvedValue(false);

    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: 'TASK' }),
    });

    expect(resolveProjectByIdOrKeyMock).toHaveBeenCalledWith('TASK', 'user-1');
    expect(canReadProjectMock).toHaveBeenCalledWith('user-1', project);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Project not found' });
  });
});
