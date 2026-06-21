/**
 * @jest-environment node
 *
 * Transactional apply-seed test. We mock @tasknebula/db so we can
 * verify:
 *   1) the seed is validated before any DB calls
 *   2) every insert flows through tx.insert (the transaction callback),
 *      not the outer db
 *   3) when an insert throws, the error propagates and the transaction
 *      rolls back (the callback rejects -> no commit), and applyWorkspaceSeed
 *      surfaces the failure to the caller.
 */

const txInsertMock = jest.fn();
const txSelectMock = jest.fn();
const dbSelectMock = jest.fn();
const dbTransactionMock = jest.fn();

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    transaction: (...args: unknown[]) => dbTransactionMock(...args),
  },
  organizations: { id: 'organizations.id' },
  organizationMembers: {
    organizationId: 'organizationMembers.organizationId',
    userId: 'organizationMembers.userId',
    role: 'organizationMembers.role',
  },
  teams: {
    id: 'teams.id',
    organizationId: 'teams.organizationId',
    slug: 'teams.slug',
  },
  teamMembers: { id: 'teamMembers.id' },
  projects: {
    id: 'projects.id',
    organizationId: 'projects.organizationId',
    key: 'projects.key',
  },
  projectMembers: { id: 'projectMembers.id' },
  workflows: {
    id: 'workflows.id',
    organizationId: 'workflows.organizationId',
    isDefault: 'workflows.isDefault',
  },
  workflowStatuses: {
    id: 'workflowStatuses.id',
    workflowId: 'workflowStatuses.workflowId',
    position: 'workflowStatuses.position',
  },
  sprints: { id: 'sprints.id' },
  issues: { id: 'issues.id' },
  users: { id: 'users.id', isSuperAdmin: 'users.isSuperAdmin' },
  ROLE_DEFAULT_PERMISSIONS: {
    product_owner: { canBrowseProject: true, canAdministerProject: true },
  },
  hasPermission: (role: string, permission: string, isSuperAdmin = false) => {
    if (isSuperAdmin) return true;
    if (permission !== 'org:settings') return false;
    return role === 'owner' || role === 'admin';
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ _and: args }),
  eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
}));

jest.mock('@paralleldrive/cuid2', () => {
  let counter = 0;
  return { createId: () => `id_${++counter}` };
});

import { applyWorkspaceSeed, ApplySeedError } from '../apply-seed';
import type { WorkspaceSeed } from '../bootstrapper';

const baseSeed: WorkspaceSeed = {
  projectName: 'Acme',
  projectKey: 'ACME',
  teams: [{ name: 'Engineering', slug: 'engineering' }],
  labels: [
    { name: 'bug', color: '#ef4444' },
    { name: 'feature', color: '#3b82f6' },
  ],
  priorities: ['high', 'medium', 'low'],
  cycles: [{ name: 'Cycle 1', startDate: '2026-05-14', endDate: '2026-05-27' }],
  issues: [
    {
      title: 'Kickoff',
      description: 'Outline scope',
      labels: ['feature'],
      priority: 'high',
      estimateHours: 3,
    },
    {
      title: 'Stand up CI',
      description: null,
      labels: [],
      priority: 'medium',
      estimateHours: 4,
    },
  ],
};

function makeWhereChain(returnValue: unknown[]) {
  const limit = jest.fn().mockResolvedValue(returnValue);
  const orderBy = jest.fn().mockReturnValue({ limit });
  const where = jest.fn().mockReturnValue({ limit, orderBy });
  const from = jest.fn().mockReturnValue({ where });
  return { from, where, orderBy, limit };
}

function setupHappyPathPreflights() {
  // 1) org lookup -> exists
  // 2) membership lookup -> owner
  // 3) actor user lookup -> not super admin (ok, owner suffices)
  // 4) existing workflow lookup -> none
  dbSelectMock
    .mockReturnValueOnce({ from: makeWhereChain([{ id: 'org_1' }]).from })
    .mockReturnValueOnce({ from: makeWhereChain([{ role: 'owner' }]).from })
    .mockReturnValueOnce({ from: makeWhereChain([{ isSuperAdmin: false }]).from })
    .mockReturnValueOnce({ from: makeWhereChain([]).from });
}

type InsertChain = { values: jest.Mock };
function makeTxWithInsertHook(insertImpl: (table: unknown) => InsertChain) {
  const tx = {
    insert: jest.fn().mockImplementation(insertImpl),
    select: jest.fn(),
  };
  // For uniqueTeamSlug + uniqueProjectKey inside the txn we need
  // tx.select(...).from(...).where(...).limit(...) -> [] (no conflict).
  tx.select.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([]),
        orderBy: () => ({ limit: () => Promise.resolve([]) }),
      }),
    }),
  }));
  return tx;
}

describe('applyWorkspaceSeed transactional behavior', () => {
  beforeEach(() => {
    // Reset both call history AND mockReturnValueOnce queues so each test
    // starts from a clean slate.
    dbSelectMock.mockReset();
    dbTransactionMock.mockReset();
    txInsertMock.mockReset();
    txSelectMock.mockReset();
  });

  it('inserts all entities through tx.insert and returns ids', async () => {
    setupHappyPathPreflights();

    const insertCalls: string[] = [];
    const tx = makeTxWithInsertHook((table) => {
      insertCalls.push(String(table));
      return {
        values: jest.fn().mockResolvedValue(undefined),
      };
    });

    // db.transaction runs the callback and returns its value.
    dbTransactionMock.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    const result = await applyWorkspaceSeed({
      seed: baseSeed,
      organizationId: 'org_1',
      userId: 'user_1',
    });

    expect(result.projectKey).toBe('ACME');
    expect(result.teamIds.length).toBe(1);
    expect(result.cycleIds.length).toBe(1);
    expect(result.issueIds.length).toBe(2);

    // Workflow + 3 statuses + 1 team + 1 teamMember + 1 project +
    // 1 projectMember + 1 sprint + 2 issues = 10 (statuses are a single
    // .insert.values([...]) so we count tables not rows).
    // Table calls expected: workflows, workflowStatuses, teams,
    // teamMembers, projects, projectMembers, sprints, issues, issues
    expect(insertCalls.length).toBeGreaterThanOrEqual(8);
  });

  it('rejects an invalid seed up-front before opening a transaction', async () => {
    await expect(
      applyWorkspaceSeed({
        seed: { ...baseSeed, projectName: '' } as unknown as WorkspaceSeed,
        organizationId: 'org_1',
        userId: 'user_1',
      })
    ).rejects.toBeInstanceOf(ApplySeedError);
    expect(dbTransactionMock).not.toHaveBeenCalled();
  });

  it('forbids non-admin users', async () => {
    // org found, membership is "member", actor not super admin.
    dbSelectMock
      .mockReturnValueOnce({ from: makeWhereChain([{ id: 'org_1' }]).from })
      .mockReturnValueOnce({ from: makeWhereChain([{ role: 'member' }]).from })
      .mockReturnValueOnce({ from: makeWhereChain([{ isSuperAdmin: false }]).from })
      .mockReturnValueOnce({ from: makeWhereChain([]).from });

    await expect(
      applyWorkspaceSeed({
        seed: baseSeed,
        organizationId: 'org_1',
        userId: 'user_1',
      })
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(dbTransactionMock).not.toHaveBeenCalled();
  });

  it('rolls back when an issue insert throws (transaction rejects)', async () => {
    setupHappyPathPreflights();

    // Make every insert succeed except `issues` — when that table is
    // touched, simulate a Postgres failure. Real drizzle re-throws inside
    // the transaction callback which causes the underlying tx to ROLLBACK.
    // We identify the `issues` table by referential identity to the mocked
    // schema export.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { issues: issuesTable } = jest.requireMock('@tasknebula/db') as {
      issues: unknown;
    };
    const tx = makeTxWithInsertHook((table) => {
      if (table === issuesTable) {
        return {
          values: jest.fn().mockRejectedValue(new Error('boom: simulated db failure')),
        };
      }
      return { values: jest.fn().mockResolvedValue(undefined) };
    });

    // Mimic drizzle: an error inside the callback triggers ROLLBACK and
    // re-throws. Awaiting the callback is enough to surface the rejection.
    dbTransactionMock.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    await expect(
      applyWorkspaceSeed({
        seed: baseSeed,
        organizationId: 'org_1',
        userId: 'user_1',
      })
    ).rejects.toThrow(/boom|simulated db failure/);

    // The transaction was opened exactly once and rolled back via
    // re-throw — i.e. no second attempt and no orphan commit.
    expect(dbTransactionMock).toHaveBeenCalledTimes(1);
  });
});
