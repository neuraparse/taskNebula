const authMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();

class MockNextRequest {
  private readonly bodyValue: string;

  constructor(
    public readonly url: string,
    private readonly init?: { method?: string; body?: string }
  ) {
    this.bodyValue = init?.body || '';
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

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-id',
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
  },
  users: {
    id: 'users.id',
    isSuperAdmin: 'users.isSuperAdmin',
  },
  organizations: {
    id: 'organizations.id',
    slug: 'organizations.slug',
  },
  organizationMembers: {
    userId: 'organizationMembers.userId',
    organizationId: 'organizationMembers.organizationId',
    role: 'organizationMembers.role',
    status: 'organizationMembers.status',
  },
  workflows: {},
  workflowStatuses: {},
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

describe('/api/organizations route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let POST: typeof import('./route').POST;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ POST } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks organization creation for regular signed-in users', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dbSelectMock.mockReturnValueOnce(limitBuilder([{ isSuperAdmin: false }]));

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Org', slug: 'new-org' }),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Only platform admins can create organizations. Ask an admin for an invite.',
    });
    expect(dbInsertMock).not.toHaveBeenCalled();
  });
});
