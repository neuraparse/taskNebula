import type { NextRequest } from 'next/server';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => {
      return {
        status: init?.status ?? 200,
        json: async () => body,
      };
    }),
  },
}));

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/auth/permissions', () => ({
  hasPermission: jest.fn(),
}));

jest.mock('drizzle-orm', () => ({
  and: jest.fn((...conditions: unknown[]) => ({ conditions })),
  desc: jest.fn((column: unknown) => ({ desc: column })),
  eq: jest.fn((left: unknown, right: unknown) => ({ left, right })),
  inArray: jest.fn((column: unknown, values: unknown[]) => ({ column, values })),
}));

jest.mock('@tasknebula/db', () => {
  const where = jest.fn();
  const orderBy = jest.fn();
  const limit = jest.fn();
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  return {
    __mockWhere: where,
    __mockOrderBy: orderBy,
    __mockLimit: limit,
    db: {
      select,
      insert: jest.fn(() => ({
        values: jest.fn(() => ({ returning: jest.fn() })),
      })),
    },
    intakeForms: {
      id: 'intakeForms.id',
      slug: 'intakeForms.slug',
      title: 'intakeForms.title',
      description: 'intakeForms.description',
      isPublic: 'intakeForms.isPublic',
      projectId: 'intakeForms.projectId',
      workspaceId: 'intakeForms.workspaceId',
      updatedAt: 'intakeForms.updatedAt',
    },
    organizationMembers: {
      organizationId: 'organizationMembers.organizationId',
      userId: 'organizationMembers.userId',
      status: 'organizationMembers.status',
    },
    projects: {
      id: 'projects.id',
      organizationId: 'projects.organizationId',
    },
  };
});

describe('GET /api/intake-forms permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const authModule = jest.requireMock('@/auth') as { auth: jest.Mock };
    const permissionsModule = jest.requireMock('@/lib/auth/permissions') as {
      hasPermission: jest.Mock;
    };
    const dbModule = jest.requireMock('@tasknebula/db') as {
      __mockWhere: jest.Mock;
      __mockOrderBy: jest.Mock;
    };

    authModule.auth.mockResolvedValue({ user: { id: 'user-1' } });
    permissionsModule.hasPermission.mockResolvedValue(true);
    dbModule.__mockWhere.mockResolvedValue([{ organizationId: 'org-1' }]);
    dbModule.__mockOrderBy.mockResolvedValue([]);
  });

  async function getRoute() {
    return import('../route');
  }

  function request(url = 'http://localhost/api/intake-forms') {
    return { nextUrl: new URL(url) } as NextRequest;
  }

  it('returns 403 when the user has active org membership but lacks org settings permission', async () => {
    const permissionsModule = jest.requireMock('@/lib/auth/permissions') as {
      hasPermission: jest.Mock;
    };
    permissionsModule.hasPermission.mockResolvedValue(false);

    const { GET } = await getRoute();
    const response = await GET(request());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('lists forms only after org settings permission passes', async () => {
    const dbModule = jest.requireMock('@tasknebula/db') as {
      __mockWhere: jest.Mock;
      __mockOrderBy: jest.Mock;
    };
    dbModule.__mockWhere
      .mockResolvedValueOnce([{ organizationId: 'org-1' }])
      .mockReturnValueOnce({ orderBy: dbModule.__mockOrderBy });
    dbModule.__mockOrderBy.mockResolvedValueOnce([{ id: 'form-1' }]);

    const { GET } = await getRoute();
    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ forms: [{ id: 'form-1' }] });
  });
});
