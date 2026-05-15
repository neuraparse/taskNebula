/**
 * @jest-environment node
 *
 * Tests for the credential-redaction behaviour on
 * GET /api/import/jobs/[id].
 *
 * The route strips the raw CSV payload (`mapping.csvText`, `mapping.preview`)
 * and replaces upstream API credentials inside `mapping.config` with `'***'`
 * so secrets stored alongside the mapping never leak back to the UI on poll.
 */

const authMock = jest.fn();
const dbSelectMock = jest.fn();

class MockNextRequest {
  constructor(public readonly url: string) {}
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

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

jest.mock('@tasknebula/db', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
  },
  importJobs: {
    id: 'importJobs.id',
    workspaceId: 'importJobs.workspaceId',
    source: 'importJobs.source',
    status: 'importJobs.status',
    total: 'importJobs.total',
    processed: 'importJobs.processed',
    errors: 'importJobs.errors',
    mapping: 'importJobs.mapping',
    createdAt: 'importJobs.createdAt',
    finishedAt: 'importJobs.finishedAt',
  },
  organizationMembers: {
    id: 'organizationMembers.id',
    organizationId: 'organizationMembers.organizationId',
    userId: 'organizationMembers.userId',
    role: 'organizationMembers.role',
  },
}));

/**
 * The route issues two selects in order:
 *   1) importJobs by id   — returns the job row (or [])
 *   2) organizationMembers — returns the membership row (or [])
 * Both terminate in `.limit(1)`. This helper builds a chain that
 * resolves at `.limit(...)`.
 */
function limitBuilder(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function queueSelects(opts: {
  job?: Record<string, unknown> | null;
  membership?: { role: string } | null;
}) {
  const { job = null, membership = null } = opts;
  dbSelectMock.mockReturnValueOnce(limitBuilder(job ? [job] : []));
  dbSelectMock.mockReturnValueOnce(limitBuilder(membership ? [membership] : []));
}

function makeJob(mapping: unknown) {
  return {
    id: 'job-1',
    workspaceId: 'ws-1',
    source: 'csv',
    status: 'completed',
    total: 10,
    processed: 10,
    errors: [],
    mapping,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    finishedAt: new Date('2025-01-01T00:01:00Z'),
  };
}

describe('GET /api/import/jobs/[id] — credential redaction', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('../route').GET;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ GET } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function callGet(id = 'job-1') {
    return GET(new NextRequestCtor(`http://localhost/api/import/jobs/${id}`), {
      params: Promise.resolve({ id }),
    });
  }

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);

    const response = await callGet();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it('returns 403 when the job lives in another workspace (no membership row)', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    queueSelects({
      job: makeJob({ config: { apiKey: 'sk-real-token' } }),
      membership: null,
    });

    const response = await callGet();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('redacts every known credential key under mapping.config to "***"', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    queueSelects({
      job: makeJob({
        config: {
          apiKey: 'sk-real-token',
          apiToken: 'jira-tk',
          accessToken: 'gh_pat',
          refreshToken: 'r',
          clientSecret: 'cs',
          password: 'p',
          authorization: 'Bearer x',
        },
      }),
      membership: { role: 'member' },
    });

    const response = await callGet();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mapping: { config: Record<string, string> };
    };
    expect(body.mapping.config).toEqual({
      apiKey: '***',
      apiToken: '***',
      accessToken: '***',
      refreshToken: '***',
      clientSecret: '***',
      password: '***',
      authorization: '***',
    });
  });

  it('preserves non-sensitive keys inside mapping.config (fieldMappings, workspaceUrl, etc.)', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    const fieldMappings = { title: 'Summary', status: 'State' };
    queueSelects({
      job: makeJob({
        config: {
          apiKey: 'sk-real-token',
          accessToken: 'gh_pat',
          fieldMappings,
          workspaceUrl: 'https://acme.atlassian.net',
          projectKey: 'ENG',
          syncDirection: 'inbound',
        },
      }),
      membership: { role: 'admin' },
    });

    const response = await callGet();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mapping: { config: Record<string, unknown> };
    };
    expect(body.mapping.config.apiKey).toBe('***');
    expect(body.mapping.config.accessToken).toBe('***');
    // Non-sensitive keys must come back untouched.
    expect(body.mapping.config.fieldMappings).toEqual(fieldMappings);
    expect(body.mapping.config.workspaceUrl).toBe('https://acme.atlassian.net');
    expect(body.mapping.config.projectKey).toBe('ENG');
    expect(body.mapping.config.syncDirection).toBe('inbound');
  });

  it('strips csvText and preview from the mapping even when no config block is present', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    queueSelects({
      job: makeJob({
        csvText: 'id,title\n1,Hello',
        preview: [{ id: '1', title: 'Hello' }],
      }),
      membership: { role: 'member' },
    });

    const response = await callGet();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mapping: Record<string, unknown>;
    };
    expect(body.mapping).not.toHaveProperty('csvText');
    expect(body.mapping).not.toHaveProperty('preview');
    // No config block in the input → none synthesized in the output.
    expect(body.mapping).not.toHaveProperty('config');
  });

  it('skips redaction without crashing when mapping.config is a non-object (string)', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    queueSelects({
      job: makeJob({ config: 'not-an-object' }),
      membership: { role: 'member' },
    });

    const response = await callGet();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mapping: { config: unknown };
    };
    // Non-object configs are passed through as-is (no crash, no rewrite).
    expect(body.mapping.config).toBe('not-an-object');
  });

  it('skips redaction without crashing when mapping.config is a number', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    queueSelects({
      job: makeJob({ config: 42 }),
      membership: { role: 'member' },
    });

    const response = await callGet();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mapping: { config: unknown };
    };
    expect(body.mapping.config).toBe(42);
  });
});
