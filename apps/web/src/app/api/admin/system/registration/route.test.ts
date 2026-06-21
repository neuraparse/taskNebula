const authMock = jest.fn();
const isSuperAdminMock = jest.fn();
const dbInsertMock = jest.fn();
const dbSelectMock = jest.fn();
const dbUpdateMock = jest.fn();

class MockNextRequest {
  private readonly bodyValue: string;
  readonly nextUrl: URL;

  constructor(
    public readonly url: string,
    private readonly init?: { method?: string; body?: string }
  ) {
    this.nextUrl = new URL(url);
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
  auth: () => authMock(),
}));

jest.mock('@/lib/auth/permissions', () => ({
  isSuperAdmin: () => isSuperAdminMock(),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'new-id',
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    insert: (...args: unknown[]) => dbInsertMock(...args),
    select: (...args: unknown[]) => dbSelectMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
  },
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  systemAuditLogs: 'systemAuditLogs',
  systemSettings: {
    id: 'systemSettings.id',
    key: 'systemSettings.key',
    value: 'systemSettings.value',
  },
}));

function selectReturning(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function insertResolving() {
  return {
    values: jest.fn().mockResolvedValue(undefined),
  };
}

function updateResolving() {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  };
}

describe('/api/admin/system/registration route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('./route').GET;
  let PUT: typeof import('./route').PUT;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ GET, PUT } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'admin-1' } });
    isSuperAdminMock.mockResolvedValue(true);
    dbInsertMock.mockReturnValue(insertResolving());
    dbUpdateMock.mockReturnValue(updateResolving());
    dbSelectMock.mockReturnValue(selectReturning([]));
  });

  it('returns the default allow-registration policy when no setting exists', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      registration: { mode: 'allow_registration' },
    });
  });

  it('updates the policy and writes a system audit log', async () => {
    dbSelectMock
      .mockReturnValueOnce(selectReturning([{ value: { mode: 'allow_registration' } }]))
      .mockReturnValueOnce(selectReturning([{ id: 'setting-1' }]));

    const response = await PUT(
      new NextRequestCtor('http://localhost:3002/api/admin/system/registration', {
        method: 'PUT',
        body: JSON.stringify({ mode: 'invite_only' }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      registration: { mode: 'invite_only', updatedBy: 'admin-1' },
    });
    expect(dbUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'systemSettings.key' })
    );
    expect(dbInsertMock).toHaveBeenCalledWith('systemAuditLogs');
  });
});
