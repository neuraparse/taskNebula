import { createHash } from 'crypto';

const dbInsertMock = jest.fn();
const dbSelectMock = jest.fn();
const dbUpdateMock = jest.fn();
const findFirstMock = jest.fn();
const bcryptHashMock = jest.fn(async () => 'hashed');
const issueEmailVerificationTokenMock = jest.fn();

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

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: (...args: unknown[]) => bcryptHashMock(...(args as [])),
  },
  hash: (...args: unknown[]) => bcryptHashMock(...(args as [])),
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: unknown[]) => findFirstMock(...args),
      },
    },
    insert: (...args: unknown[]) => dbInsertMock(...args),
    select: (...args: unknown[]) => dbSelectMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
  },
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  users: {
    id: 'users.id',
    name: 'users.name',
    email: 'users.email',
    password: 'users.password',
    status: 'users.status',
  },
  organizationMembers: {
    userId: 'organizationMembers.userId',
    status: 'organizationMembers.status',
  },
  systemSettings: {
    id: 'systemSettings.id',
    key: 'systemSettings.key',
    value: 'systemSettings.value',
  },
}));

jest.mock('@/lib/auth/email-verification', () => ({
  issueEmailVerificationToken: (...args: unknown[]) => issueEmailVerificationTokenMock(...args),
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

function insertReturning(result: unknown) {
  return {
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(result),
    }),
  };
}

function updateReturning(result: unknown) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function updateResolving(result?: unknown) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(result),
    }),
  };
}

function selectRegistrationPolicy(mode?: string) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(mode ? [{ value: { mode } }] : []),
      }),
    }),
  };
}

describe('/api/auth/signup route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let POST: typeof import('./route').POST;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ POST } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    dbSelectMock.mockReturnValue(selectRegistrationPolicy());
  });

  it('returns 400 when required fields missing', async () => {
    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@e.com' }),
      })
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Missing required fields' });
  });

  it('returns 400 when password too short', async () => {
    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name: 'Alice', email: 'a@e.com', password: 'abc' }),
      })
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Password must be at least 8 characters',
    });
  });

  it('returns a generic success-ish response when user already exists (no enumeration)', async () => {
    findFirstMock.mockResolvedValue({
      id: 'u1',
      email: 'a@e.com',
      status: 'active',
      password: 'already-set',
    });

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name: 'Alice', email: 'a@e.com', password: 'abcdefgh' }),
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'If that email is available, an account will be created',
    });
  });

  it('activates an invited user when they sign up', async () => {
    const inviteToken = 'invite-token-1';
    findFirstMock.mockResolvedValue({
      id: 'u1',
      email: 'a@e.com',
      status: 'invited',
      password: null,
      inviteTokenHash: createHash('sha256').update(inviteToken).digest('hex'),
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    dbUpdateMock
      .mockReturnValueOnce(updateReturning([{ id: 'u1', name: 'Alice', email: 'a@e.com' }]))
      .mockReturnValueOnce(updateResolving());

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alice',
          email: 'a@e.com',
          password: 'abcdefgh',
          inviteToken,
        }),
      })
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { message: string; user: { id: string } };
    expect(body.message).toBe('Account activated successfully');
    expect(body.user.id).toBe('u1');
    expect(bcryptHashMock).toHaveBeenCalledWith('abcdefgh', 10);
  });

  it('rejects an expired invited-user token', async () => {
    const inviteToken = 'invite-token-1';
    findFirstMock.mockResolvedValue({
      id: 'u1',
      email: 'a@e.com',
      status: 'invited',
      password: null,
      inviteTokenHash: createHash('sha256').update(inviteToken).digest('hex'),
      inviteTokenExpiresAt: new Date(Date.now() - 60_000),
    });

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alice',
          email: 'a@e.com',
          password: 'abcdefgh',
          inviteToken,
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid or expired invitation',
    });
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it('rejects new public signups when registration is invite-only', async () => {
    dbSelectMock.mockReturnValue(selectRegistrationPolicy('invite_only'));
    findFirstMock.mockResolvedValue(undefined);

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name: 'Bob', email: 'b@e.com', password: 'secret12' }),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'REGISTRATION_INVITE_REQUIRED',
      code: 'REGISTRATION_INVITE_REQUIRED',
    });
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('rejects invited-user activation when registration is admin-created only', async () => {
    dbSelectMock.mockReturnValue(selectRegistrationPolicy('admin_created_only'));
    const inviteToken = 'invite-token-1';
    findFirstMock.mockResolvedValue({
      id: 'u1',
      email: 'a@e.com',
      status: 'invited',
      password: null,
      inviteTokenHash: createHash('sha256').update(inviteToken).digest('hex'),
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    });

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alice',
          email: 'a@e.com',
          password: 'abcdefgh',
          inviteToken,
        }),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'REGISTRATION_ADMIN_ONLY',
      code: 'REGISTRATION_ADMIN_ONLY',
    });
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it('creates a new user on happy path', async () => {
    findFirstMock.mockResolvedValue(undefined);
    const insertBuilder = insertReturning([{ id: 'u2', name: 'Bob', email: 'b@e.com' }]);
    dbInsertMock.mockReturnValueOnce(insertBuilder);

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name: 'Bob', email: ' B@E.COM ', password: 'secret12' }),
      })
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      message: string;
      user: { id: string; email: string };
    };
    expect(body.message).toBe('User created successfully');
    expect(body.user).toEqual({ id: 'u2', name: 'Bob', email: 'b@e.com' });
    expect(bcryptHashMock).toHaveBeenCalledWith('secret12', 10);
    expect(findFirstMock).toHaveBeenCalledWith({
      where: expect.objectContaining({ right: 'b@e.com' }),
    });
    expect(insertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'b@e.com' })
    );
  });
});
