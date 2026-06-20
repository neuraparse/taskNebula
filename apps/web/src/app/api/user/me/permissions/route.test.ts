/**
 * @jest-environment node
 */

const authMock = jest.fn();
const dbSelectMock = jest.fn();

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

jest.mock('@tasknebula/db', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
  },
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  getRolePermissions: (role: string) =>
    role === 'admin' ? ['org:view', 'project:create'] : ['org:view'],
  organizationMembers: {
    role: 'organizationMembers.role',
    status: 'organizationMembers.status',
    userId: 'organizationMembers.userId',
    organizationId: 'organizationMembers.organizationId',
  },
  SUPER_ADMIN_PERMISSIONS: ['system:manage'],
  users: {
    id: 'users.id',
    isSuperAdmin: 'users.isSuperAdmin',
  },
}));

function limitBuilder(result: unknown, captureWhere?: (condition: unknown) => void) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn((condition: unknown) => {
        captureWhere?.(condition);
        return {
          limit: jest.fn().mockResolvedValue(result),
        };
      }),
    }),
  };
}

describe('GET /api/user/me/permissions', () => {
  let GET: typeof import('./route').GET;

  beforeAll(async () => {
    ({ GET } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('only resolves permissions from active organization memberships', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });

    let membershipWhere: unknown;
    dbSelectMock
      .mockReturnValueOnce(limitBuilder([{ isSuperAdmin: false }]))
      .mockReturnValueOnce(limitBuilder([], (condition) => (membershipWhere = condition)));

    const response = await GET(
      new Request('http://localhost/api/user/me/permissions?organizationId=org-1') as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      organizationId: 'org-1',
      role: null,
      isSuperAdmin: false,
      permissions: [],
    });
    expect(JSON.stringify(membershipWhere)).toContain('organizationMembers.status');
    expect(JSON.stringify(membershipWhere)).toContain('active');
  });
});
