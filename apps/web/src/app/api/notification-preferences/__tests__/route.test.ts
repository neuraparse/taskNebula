/**
 * @jest-environment node
 */

const authMock = jest.fn();
const hasPermissionMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();
const dbUpdateMock = jest.fn();

class MockNextRequest {
  private readonly bodyValue: string;
  readonly nextUrl: URL;

  constructor(
    public readonly url: string,
    private readonly init?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
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

jest.mock('@/lib/auth/permissions', () => ({
  hasPermission: (...args: unknown[]) => hasPermissionMock(...args),
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
  },
  notificationPreferences: {
    id: 'np.id',
    userId: 'np.userId',
    organizationId: 'np.organizationId',
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

function selectReturning(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(rows),
    }),
  };
}

function insertReturning(row: unknown) {
  return {
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([row]),
    }),
  };
}

function updateReturning(row: unknown) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([row]),
      }),
    }),
  };
}

describe('/api/notification-preferences route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('../route').GET;
  let POST: typeof import('../route').POST;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ GET, POST } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermissionMock.mockResolvedValue(true);
  });

  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      authMock.mockResolvedValue(null);
      const response = await GET(
        new NextRequestCtor(
          'http://localhost/api/notification-preferences?organizationId=org-1'
        )
      );
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    });

    it('returns 400 when organizationId is missing', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const response = await GET(
        new NextRequestCtor('http://localhost/api/notification-preferences')
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'organizationId is required',
      });
    });

    it('returns quiet-by-default preferences when no prefs row exists', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(selectReturning([]));

      const response = await GET(
        new NextRequestCtor(
          'http://localhost/api/notification-preferences?organizationId=org-1'
        )
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        preferences: Record<string, unknown>;
      };
      expect(body.preferences).toMatchObject({
        userId: 'user-1',
        organizationId: 'org-1',
        emailOnCommented: false,
        emailOnMentioned: true,
        emailOnAssigned: true,
        inAppOnAssigned: true,
        inAppOnMentioned: true,
        inAppOnCommented: true,
        inAppOnStatusChanged: true,
        inAppOnIssueCreated: true,
        inAppOnSprintStarted: true,
        inAppOnSprintCompleted: true,
        digestFrequency: 'none',
        doNotDisturb: false,
        doNotDisturbStart: null,
        doNotDisturbEnd: null,
      });
    });

    it('returns existing prefs row verbatim', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const existing = {
        id: 'pref-1',
        userId: 'user-1',
        organizationId: 'org-1',
        enableEmail: false,
        emailOnCommented: true,
        digestFrequency: 'daily',
        doNotDisturb: true,
        doNotDisturbStart: '22:00',
        doNotDisturbEnd: '08:00',
      };
      dbSelectMock.mockReturnValueOnce(selectReturning([existing]));

      const response = await GET(
        new NextRequestCtor(
          'http://localhost/api/notification-preferences?organizationId=org-1'
        )
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { preferences: unknown };
      expect(body.preferences).toEqual(existing);
    });
  });

  describe('POST', () => {
    function makeRequest(body: unknown) {
      return new NextRequestCtor('http://localhost/api/notification-preferences', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    it('returns 401 when unauthenticated', async () => {
      authMock.mockResolvedValue(null);
      const response = await POST(makeRequest({ organizationId: 'org-1' }));
      expect(response.status).toBe(401);
    });

    it('returns 403 when user lacks permission', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      hasPermissionMock.mockResolvedValueOnce(false);
      const response = await POST(makeRequest({ organizationId: 'org-1' }));
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: 'Insufficient permissions',
      });
    });

    it('creates a new prefs row with minimal valid body', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(selectReturning([]));
      const valuesMock = jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'new-pref' }]),
      });
      dbInsertMock.mockReturnValueOnce({ values: valuesMock });

      const response = await POST(makeRequest({ organizationId: 'org-1' }));

      expect(response.status).toBe(200);
      expect(dbInsertMock).toHaveBeenCalledTimes(1);
      expect(dbUpdateMock).not.toHaveBeenCalled();
      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
        })
      );
    });

    it('accepts doNotDisturbStart/End as null (regression for the zod nullable fix)', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(selectReturning([]));
      dbInsertMock.mockReturnValueOnce(insertReturning({ id: 'new-pref' }));

      const response = await POST(
        makeRequest({
          organizationId: 'org-1',
          doNotDisturb: false,
          doNotDisturbStart: null,
          doNotDisturbEnd: null,
        })
      );

      expect(response.status).toBe(200);
    });

    it('accepts valid overnight DND range "22:00" → "08:00"', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(selectReturning([]));
      dbInsertMock.mockReturnValueOnce(insertReturning({ id: 'new-pref' }));

      const response = await POST(
        makeRequest({
          organizationId: 'org-1',
          doNotDisturb: true,
          doNotDisturbStart: '22:00',
          doNotDisturbEnd: '08:00',
        })
      );

      expect(response.status).toBe(200);
    });

    it('rejects "25:00" as invalid HH:MM', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const response = await POST(
        makeRequest({
          organizationId: 'org-1',
          doNotDisturbStart: '25:00',
        })
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('Invalid request data');
    });

    it('rejects "22:0" as invalid HH:MM (not zero-padded)', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const response = await POST(
        makeRequest({
          organizationId: 'org-1',
          doNotDisturbStart: '22:0',
        })
      );
      expect(response.status).toBe(400);
    });

    it('updates existing row via db.update (not insert)', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(
        selectReturning([{ id: 'existing-1', userId: 'user-1' }])
      );
      const setMock = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: 'existing-1' }]),
        }),
      });
      dbUpdateMock.mockReturnValueOnce({ set: setMock });

      const response = await POST(
        makeRequest({ organizationId: 'org-1', enableEmail: false })
      );

      expect(response.status).toBe(200);
      expect(dbUpdateMock).toHaveBeenCalledTimes(1);
      expect(dbInsertMock).not.toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          enableEmail: false,
          updatedAt: expect.any(Date),
        })
      );
    });

    it('rejects invalid digestFrequency enum "yearly"', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const response = await POST(
        makeRequest({ organizationId: 'org-1', digestFrequency: 'yearly' })
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('Invalid request data');
    });
  });
});
