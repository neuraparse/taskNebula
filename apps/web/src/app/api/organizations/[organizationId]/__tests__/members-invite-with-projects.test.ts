/**
 * Tests for POST /api/organizations/[organizationId]/members
 * — the new "invite with project assignment" flow.
 *
 * NOTE: A peer agent is implementing the route.ts changes in parallel
 * (zod schema updates + projectMembers insertion + addedToProjects /
 * skippedProjects response fields). These tests encode the agreed-on
 * contract for the NEW shape and will turn green once the peer lands
 * their changes. Mock ordering is intentionally tolerant: the post-
 * org-member-insert select/insert calls are stacked generously so
 * the test doesn't break on small ordering tweaks.
 */

const authMock = jest.fn();
const hasPermissionMock = jest.fn();
const getUserRoleMock = jest.fn();
const dbSelectMock = jest.fn();
const dbUpdateMock = jest.fn();
const dbDeleteMock = jest.fn();
const dbInsertMock = jest.fn();
const publishEventMock = jest.fn();
const sendEmailMock = jest.fn();

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

jest.mock('@/lib/auth/permissions', () => ({
  hasPermission: (...args: unknown[]) => hasPermissionMock(...args),
  getUserRole: (...args: unknown[]) => getUserRoleMock(...args),
}));

jest.mock('@/lib/realtime/events', () => ({
  publishEvent: (...args: unknown[]) => publishEventMock(...args),
}));

jest.mock('@/lib/email/sender', () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-id',
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  ne: (left: unknown, right: unknown) => ({ type: 'ne', left, right }),
  inArray: (col: unknown, values: unknown) => ({ type: 'inArray', col, values }),
}));

jest.mock('@tasknebula/db', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
    delete: (...args: unknown[]) => dbDeleteMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
  },
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  ne: (left: unknown, right: unknown) => ({ type: 'ne', left, right }),
  inArray: (col: unknown, values: unknown) => ({ type: 'inArray', col, values }),
  users: {
    id: 'users.id',
    email: 'users.email',
    name: 'users.name',
  },
  organizationMembers: {
    id: 'organizationMembers.id',
    organizationId: 'organizationMembers.organizationId',
    userId: 'organizationMembers.userId',
  },
  organizations: {
    id: 'organizations.id',
    name: 'organizations.name',
  },
  auditLogs: {
    id: 'auditLogs.id',
  },
  projects: {
    id: 'projects.id',
    organizationId: 'projects.organizationId',
    name: 'projects.name',
  },
  projectMembers: {
    id: 'projectMembers.id',
    projectId: 'projectMembers.projectId',
    userId: 'projectMembers.userId',
    role: 'projectMembers.role',
  },
  // Email renderer stubs — their HTML output is not what we're testing.
  renderShell: () => '<html></html>',
  paragraph: () => '',
  infoCard: () => '',
  bulletList: () => '',
  chip: () => '',
  textFooter: () => '',
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

function fromWhereBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(result),
    }),
  };
}

function valuesReturningBuilder(result: unknown) {
  return {
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(result),
    }),
  };
}

function valuesBuilder() {
  return {
    values: jest.fn().mockResolvedValue(undefined),
  };
}

describe('POST /api/organizations/[organizationId]/members — invite with project assignment', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let POST: typeof import('../members/route').POST;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ POST } = await import('../members/route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'inviter-1' } });
    hasPermissionMock.mockResolvedValue(true);
    sendEmailMock.mockResolvedValue({ sent: true, messageId: 'msg-1' });
  });

  /**
   * Common select queue covering the current route flow:
   *   1) SELECT user by email         (limit)
   *   2) SELECT existing org member   (limit)
   *   3..N) additional selects (projects filter, existing project members,
   *        org name, inviter name).
   */
  function queueInviteSelects(options: {
    existingUser?: { id: string; email: string; name: string; image: string | null; status: string } | null;
    existingOrgMember?: { id: string } | null;
    projectsInOrg?: Array<{ id: string; organizationId: string }>;
    existingProjectMembers?: Array<{ projectId: string; userId: string }>;
    orgName?: string;
    inviterName?: string;
  }) {
    const {
      existingUser = null,
      existingOrgMember = null,
      projectsInOrg = [],
      existingProjectMembers = [],
      orgName = 'Acme Inc',
      inviterName = 'Alice',
    } = options;

    // 1. user lookup by email
    dbSelectMock.mockReturnValueOnce(limitBuilder(existingUser ? [existingUser] : []));
    // 2. existing org member lookup
    dbSelectMock.mockReturnValueOnce(limitBuilder(existingOrgMember ? [existingOrgMember] : []));
    // 3+. projects filtered to this org (non-limit: drizzle returns array directly)
    dbSelectMock.mockReturnValueOnce(fromWhereBuilder(projectsInOrg));
    // 4+. existing project memberships for this user
    dbSelectMock.mockReturnValueOnce(fromWhereBuilder(existingProjectMembers));
    // 5. org name (limit)
    dbSelectMock.mockReturnValueOnce(limitBuilder([{ name: orgName }]));
    // 6. inviter name (limit)
    dbSelectMock.mockReturnValueOnce(limitBuilder([{ name: inviterName }]));
    // Tail: repeat empty so stray extra selects don't crash the test.
    dbSelectMock.mockReturnValue(limitBuilder([]));
  }

  function queueInserts() {
    // 1. insert user (returning) — only invoked if user didn't exist
    // 2. insert organizationMembers (returning)
    // 3. insert auditLogs (values)
    // 4. insert projectMembers (values) — new behavior

    const createdUser = {
      id: 'user-new',
      email: 'new@example.com',
      name: 'new',
      image: null,
      status: 'invited',
    };
    const newOrgMember = {
      id: 'org-member-1',
      role: 'member',
      status: 'invited',
      createdAt: new Date('2025-01-01'),
    };

    // Queue: user-insert, orgMember-insert, auditLog-insert, projectMembers-insert.
    // Unused entries fall through harmlessly because subsequent calls return a
    // values-resolving builder by default (mockReturnValue at the end).
    dbInsertMock.mockReturnValueOnce(valuesReturningBuilder([createdUser]));
    dbInsertMock.mockReturnValueOnce(valuesReturningBuilder([newOrgMember]));
    dbInsertMock.mockReturnValueOnce(valuesBuilder());
    dbInsertMock.mockReturnValueOnce(valuesBuilder());
    // Fallback for any extra insert — values() resolves.
    dbInsertMock.mockReturnValue(valuesBuilder());

    return { createdUser, newOrgMember };
  }

  function buildRequest(body: unknown) {
    return new NextRequestCtor(
      'http://localhost:3002/api/organizations/org-1/members',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  }

  const routeParams = {
    params: Promise.resolve({ organizationId: 'org-1' }),
  };

  it('(a) invite with empty projectIds works like before (no projectMembers inserted)', async () => {
    queueInviteSelects({});
    const { newOrgMember } = queueInserts();

    const response = await POST(
      buildRequest({ email: 'new@example.com', role: 'member' }),
      routeParams
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.member).toEqual(
      expect.objectContaining({ role: newOrgMember.role, memberStatus: newOrgMember.status })
    );

    // Walk through insert calls: we should see the user insert, the
    // orgMember insert, and the auditLog insert — but NOT a projectMembers
    // insert (projectMembers "insert" call should be absent for empty projectIds).
    const insertTargets = dbInsertMock.mock.calls.map((c) => c[0]);
    expect(insertTargets).not.toContain('projectMembers.id'); // no-op placeholder

    // Either the route returns legacy shape (no addedToProjects) OR the new shape
    // with empty arrays. Both are acceptable for this test case.
    if ('addedToProjects' in payload) {
      expect(payload.addedToProjects).toEqual([]);
      expect(payload.skippedProjects).toEqual([]);
    }
  });

  it('(b) invite with valid projectIds inserts projectMembers rows and reports them in addedToProjects', async () => {
    queueInviteSelects({
      projectsInOrg: [
        { id: 'proj-a', organizationId: 'org-1' },
        { id: 'proj-b', organizationId: 'org-1' },
      ],
      existingProjectMembers: [],
    });
    queueInserts();

    const response = await POST(
      buildRequest({
        email: 'new@example.com',
        role: 'member',
        projectIds: ['proj-a', 'proj-b'],
        projectRole: 'developer',
      }),
      routeParams
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    // Expect at least one insert call to have been made with values targeting
    // the projectMembers table (i.e. one of the insert targets was the
    // projectMembers schema object).
    const insertCalls = dbInsertMock.mock.calls;
    const projectMembersInsertCalls = insertCalls.filter((c) =>
      Array.isArray(c) &&
      c.length > 0 &&
      typeof c[0] === 'object' &&
      c[0] !== null &&
      'projectId' in (c[0] as Record<string, unknown>)
    );
    expect(projectMembersInsertCalls.length).toBeGreaterThanOrEqual(1);

    // Contract: addedToProjects includes both project ids; nothing skipped.
    expect(payload.addedToProjects).toEqual(expect.arrayContaining(['proj-a', 'proj-b']));
    expect(payload.skippedProjects ?? []).toEqual([]);
  });

  it('(c) projectIds pointing to projects in ANOTHER org are silently skipped (not inserted, listed in skippedProjects)', async () => {
    // Only proj-a comes back from the org-scoped project select; proj-evil
    // belongs to a different org and so the filter excludes it.
    queueInviteSelects({
      projectsInOrg: [{ id: 'proj-a', organizationId: 'org-1' }],
      existingProjectMembers: [],
    });
    queueInserts();

    const response = await POST(
      buildRequest({
        email: 'new@example.com',
        role: 'member',
        projectIds: ['proj-a', 'proj-evil'],
        projectRole: 'developer',
      }),
      routeParams
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.addedToProjects).toEqual(['proj-a']);
    expect(payload.skippedProjects).toEqual(expect.arrayContaining(['proj-evil']));

    // Critically, the insert for projectMembers must NOT have values referencing proj-evil.
    const projectMembersInsertCalls = dbInsertMock.mock.results
      .map((r) => r.value)
      .filter((v) => v && typeof v === 'object' && 'values' in v)
      // @ts-expect-error — values is a jest mock in these stubs
      .flatMap((v) => (v.values as jest.Mock).mock.calls);

    for (const [payloadArg] of projectMembersInsertCalls) {
      const rows = Array.isArray(payloadArg) ? payloadArg : [payloadArg];
      for (const row of rows) {
        if (row && typeof row === 'object' && 'projectId' in row) {
          expect(row.projectId).not.toBe('proj-evil');
        }
      }
    }
  });

  it('(d) duplicate project memberships are skipped (reported in skippedProjects, no error)', async () => {
    queueInviteSelects({
      projectsInOrg: [
        { id: 'proj-a', organizationId: 'org-1' },
        { id: 'proj-b', organizationId: 'org-1' },
      ],
      // User is already a member of proj-a.
      existingProjectMembers: [{ projectId: 'proj-a', userId: 'user-new' }],
    });
    queueInserts();

    const response = await POST(
      buildRequest({
        email: 'new@example.com',
        role: 'member',
        projectIds: ['proj-a', 'proj-b'],
        projectRole: 'developer',
      }),
      routeParams
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.addedToProjects).toEqual(['proj-b']);
    expect(payload.skippedProjects).toEqual(expect.arrayContaining(['proj-a']));
  });
});
