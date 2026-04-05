const authMock = jest.fn();
const resolveProjectByIdOrKeyMock = jest.fn();
const dbSelectMock = jest.fn();
const dbUpdateMock = jest.fn();
const dbDeleteMock = jest.fn();

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
}));

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

jest.mock('@/lib/projects/server', () => ({
  resolveProjectByIdOrKey: (...args: unknown[]) => resolveProjectByIdOrKeyMock(...args),
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
    delete: (...args: unknown[]) => dbDeleteMock(...args),
  },
  savedFilters: {
    id: 'savedFilters.id',
    organizationId: 'savedFilters.organizationId',
    projectId: 'savedFilters.projectId',
    userId: 'savedFilters.userId',
  },
  organizationMembers: {
    id: 'organizationMembers.id',
    organizationId: 'organizationMembers.organizationId',
    userId: 'organizationMembers.userId',
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

function limitBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe('project view detail route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let PATCH: typeof import('./route').PATCH;
  let DELETE: typeof import('./route').DELETE;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ PATCH, DELETE } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates a saved project view and returns serialized metadata', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    resolveProjectByIdOrKeyMock.mockResolvedValue({
      id: 'project-1',
      key: 'API',
      organizationId: 'org-1',
    });

    dbSelectMock
      .mockReturnValueOnce(limitBuilder([{ id: 'member-1' }]))
      .mockReturnValueOnce(
        limitBuilder([
          {
            id: 'view-1',
            userId: 'user-1',
            projectId: 'project-1',
            organizationId: 'org-1',
            name: 'Release Board',
            description: null,
            query: 'project = API',
            criteria: {
              scope: 'teamspace',
              teamspaceId: 'team-1',
              defaultView: false,
            },
            viewType: 'board',
            isPublic: true,
            isStarred: false,
            updatedAt: '2026-04-05T00:00:00.000Z',
          },
        ])
      )
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) });

    const updateSetMock = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([
          {
            id: 'view-1',
            userId: 'user-1',
            projectId: 'project-1',
            organizationId: 'org-1',
            name: 'Pinned board',
            description: null,
            query: 'project = API',
            criteria: {
              scope: 'teamspace',
              teamspaceId: 'team-1',
              defaultView: true,
            },
            viewType: 'board',
            isPublic: true,
            isStarred: true,
            updatedAt: '2026-04-05T00:00:00.000Z',
          },
        ]),
      }),
    });

    dbUpdateMock.mockReturnValue({ set: updateSetMock });

    const response = await PATCH(
      new NextRequestCtor('http://localhost:3002/api/projects/project-1/views/view-1?teamId=team-1', {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Pinned board',
          isPinned: true,
          isDefault: true,
        }),
      }),
      {
        params: Promise.resolve({ projectId: 'project-1', viewId: 'view-1' }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      view: expect.objectContaining({
        id: 'view-1',
        name: 'Pinned board',
        scope: 'teamspace',
        teamspaceId: 'team-1',
        isDefault: true,
        isOwned: true,
      }),
    });
  });

  it('deletes an owned view', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    resolveProjectByIdOrKeyMock.mockResolvedValue({
      id: 'project-1',
      key: 'API',
      organizationId: 'org-1',
    });

    dbSelectMock
      .mockReturnValueOnce(limitBuilder([{ id: 'member-1' }]))
      .mockReturnValueOnce(
        limitBuilder([
          {
            id: 'view-1',
            userId: 'user-1',
            projectId: 'project-1',
            organizationId: 'org-1',
          },
        ])
      );

    const whereMock = jest.fn().mockResolvedValue(undefined);
    dbDeleteMock.mockReturnValue({ where: whereMock });

    const response = await DELETE(new NextRequestCtor('http://localhost:3002/api/projects/project-1/views/view-1'), {
      params: Promise.resolve({ projectId: 'project-1', viewId: 'view-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
