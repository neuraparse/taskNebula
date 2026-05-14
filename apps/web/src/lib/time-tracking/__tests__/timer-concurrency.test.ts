/**
 * @jest-environment node
 *
 * Validates the "only one running timer per user" invariant at the route
 * layer. The DB-level guarantee is the partial unique index in migration
 * 0028, but the route also pre-checks and translates the 23505 violation
 * into a 409 response. We exercise both branches:
 *
 *   - the pre-check sees an existing running timer → 409 with body.running
 *   - a TOCTOU race slips past the pre-check and the INSERT throws
 *     `{ code: '23505' }` → still 409
 *   - happy path: no running timer → 201
 *
 * The Drizzle query builder is mocked so the test runs in pure Node without a
 * Postgres connection.
 */

// ── Mocks ────────────────────────────────────────────────────────────────
// `auth` returns a stable user.
jest.mock('@/auth', () => ({
  auth: jest.fn(async () => ({ user: { id: 'user_abc' } })),
}));

// Hand-rolled fluent stub for the bits of `db` the route touches. Each test
// re-installs the implementations it cares about. We track inserts so we can
// assert at-most-one running row.
const selectImpl = jest.fn();
const insertImpl = jest.fn();

const dbStub = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(async (..._args: any[]) => selectImpl()),
      })),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(async () => insertImpl()),
    })),
  })),
};

jest.mock('@tasknebula/db', () => ({
  db: dbStub,
  timeEntries: {},
  issues: {},
  users: {},
  projects: {},
  projectMembers: {},
  organizationMembers: {},
  eq: () => ({}),
  and: () => ({}),
  isNull: () => ({}),
}));

// `assertIssueAccess` does several DB calls of its own. Stub it directly so the
// concurrency test stays focused on the start-timer route logic.
jest.mock('@/lib/time-tracking/server', () => ({
  assertIssueAccess: jest.fn(async () => ({
    ok: true,
    issue: {
      id: 'iss_1',
      projectId: 'proj_1',
      organizationId: 'org_1',
      key: 'TN-1',
      title: 'Test',
    },
  })),
  recomputeActualHours: jest.fn(async () => 0),
}));

// Helper to call the route handler with minimal Next plumbing.
async function callStart() {
  // Re-import inside the test scope so mocks apply.
  const { POST } = await import(
    '@/app/api/issues/[issueId]/timer/start/route'
  );
  const req = new Request('http://localhost/api/issues/iss_1/timer/start', {
    method: 'POST',
  });
  return POST(req as any, { params: Promise.resolve({ issueId: 'iss_1' }) });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/issues/[id]/timer/start — concurrency', () => {
  it('returns 201 when no timer is running', async () => {
    selectImpl.mockReturnValueOnce([]); // no existing
    insertImpl.mockReturnValueOnce([
      { id: 'te_new', issueId: 'iss_1', startedAt: new Date().toISOString() },
    ]);

    const res = await callStart();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.entry.id).toBe('te_new');
  });

  it('returns 409 when the pre-check finds an existing running timer', async () => {
    selectImpl.mockReturnValueOnce([
      { id: 'te_existing', issueId: 'iss_other', startedAt: new Date() },
    ]);

    const res = await callStart();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already running/i);
    expect(body.running.id).toBe('te_existing');
    // INSERT must NOT run when the pre-check trips.
    expect(insertImpl).not.toHaveBeenCalled();
  });

  it('returns 409 when the unique-index races and the insert throws 23505', async () => {
    selectImpl.mockReturnValueOnce([]); // pre-check passes
    insertImpl.mockImplementationOnce(() => {
      // Simulate the DB-level partial-unique violation from migration 0028.
      const err: any = new Error('duplicate key value violates unique constraint');
      err.code = '23505';
      throw err;
    });

    const res = await callStart();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already running/i);
  });
});
