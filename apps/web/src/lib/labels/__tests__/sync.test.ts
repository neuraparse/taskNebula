/**
 * Unit tests for the first-class label write-through sync
 * (@/lib/labels/sync). The db is mocked like neighboring route tests
 * (see e.g. api/sprints/[sprintId]/route.test.ts).
 */

const dbTransactionMock = jest.fn();

jest.mock('@tasknebula/db', () => ({
  db: {
    transaction: (...args: unknown[]) => dbTransactionMock(...args),
  },
  labels: {
    id: 'labels.id',
    organizationId: 'labels.organizationId',
    projectId: 'labels.projectId',
    name: 'labels.name',
  },
  issueLabels: {
    issueId: 'issueLabels.issueId',
    labelId: 'issueLabels.labelId',
    organizationId: 'issueLabels.organizationId',
  },
}));

interface MockClause {
  type: string;
  args?: unknown[];
  left?: unknown;
  right?: unknown;
}

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  inArray: (left: unknown, right: unknown) => ({ type: 'inArray', left, right }),
  isNull: (left: unknown) => ({ type: 'isNull', left }),
  notInArray: (left: unknown, right: unknown) => ({ type: 'notInArray', left, right }),
}));

import { normalizeLabelNames, resolveLabels, syncIssueLabels } from '../sync';

type Executor = NonNullable<Parameters<typeof resolveLabels>[1]>;

interface RecordedCalls {
  deletes: MockClause[];
  inserts: { table: unknown; values: unknown }[];
  selects: number;
}

/**
 * Minimal chainable drizzle executor double.
 * - `selectQueue` feeds successive `select().from().where()` results.
 * - `insertReturningQueue` feeds successive `.onConflictDoNothing().returning()` results.
 */
function createFakeExecutor(options: {
  selectQueue: unknown[][];
  insertReturningQueue?: unknown[][];
}) {
  const calls: RecordedCalls = { deletes: [], inserts: [], selects: 0 };

  const executor = {
    select: () => ({
      from: () => ({
        where: () => {
          calls.selects += 1;
          return Promise.resolve(options.selectQueue.shift() ?? []);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        calls.inserts.push({ table, values });
        return {
          onConflictDoNothing: () => {
            const returned = options.insertReturningQueue?.shift() ?? [];
            // Awaitable directly (issue_labels insert) AND `.returning()`-able
            // (labels insert) — mirror drizzle's builder surface.
            return Object.assign(Promise.resolve(returned), {
              returning: () => Promise.resolve(returned),
            });
          },
        };
      },
    }),
    delete: () => ({
      where: (clause: MockClause) => {
        calls.deletes.push(clause);
        return Promise.resolve(undefined);
      },
    }),
  };

  return { executor: executor as unknown as Executor, calls };
}

const bugLabel = {
  id: 'lbl_bug',
  organizationId: 'org_1',
  projectId: null,
  name: 'bug',
  color: '#6B7280',
};

const frontendLabel = {
  id: 'lbl_frontend',
  organizationId: 'org_1',
  projectId: null,
  name: 'frontend',
  color: '#6B7280',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('normalizeLabelNames', () => {
  it('trims, drops empties, dedupes, and preserves first-seen order', () => {
    expect(normalizeLabelNames(['  bug ', 'frontend', 'bug', '', '   '])).toEqual([
      'bug',
      'frontend',
    ]);
  });

  it('drops names longer than the varchar(100) column limit', () => {
    const tooLong = 'x'.repeat(101);
    const exactLimit = 'y'.repeat(100);
    expect(normalizeLabelNames([tooLong, exactLimit])).toEqual([exactLimit]);
  });
});

describe('resolveLabels', () => {
  it('returns existing org-wide labels and creates missing ones', async () => {
    const { executor, calls } = createFakeExecutor({
      selectQueue: [[bugLabel]],
      insertReturningQueue: [[frontendLabel]],
    });

    const result = await resolveLabels(
      { organizationId: 'org_1', names: ['bug', 'frontend'], createdBy: 'user_1' },
      executor
    );

    // Output order matches input order.
    expect(result.map((l) => l.name)).toEqual(['bug', 'frontend']);

    // Only the missing label is inserted, org-wide (projectId null), with creator.
    expect(calls.inserts).toHaveLength(1);
    const inserted = calls.inserts[0]!.values as Array<Record<string, unknown>>;
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      organizationId: 'org_1',
      projectId: null,
      name: 'frontend',
      createdBy: 'user_1',
    });
    expect(typeof inserted[0]!.id).toBe('string');
    expect((inserted[0]!.id as string).length).toBeGreaterThan(0);
  });

  it('re-reads labels skipped by the unique-index conflict guard', async () => {
    const { executor, calls } = createFakeExecutor({
      // 1st select: nothing exists; insert "wins" zero rows (concurrent
      // create); 2nd select: the concurrently created row.
      selectQueue: [[], [bugLabel]],
      insertReturningQueue: [[]],
    });

    const result = await resolveLabels({ organizationId: 'org_1', names: ['bug'] }, executor);

    expect(result).toEqual([bugLabel]);
    expect(calls.selects).toBe(2);
  });

  it('returns [] without touching the db for an empty name set', async () => {
    const { executor, calls } = createFakeExecutor({ selectQueue: [] });

    const result = await resolveLabels({ organizationId: 'org_1', names: ['  ', ''] }, executor);

    expect(result).toEqual([]);
    expect(calls.selects).toBe(0);
    expect(calls.inserts).toHaveLength(0);
  });
});

describe('syncIssueLabels', () => {
  it('replaces issue_labels rows: deletes absent, inserts new with org stamped', async () => {
    const { executor, calls } = createFakeExecutor({
      // select #1: existing labels lookup → only "bug" exists
      // select #2: existing issue_labels rows → issue already linked to "bug"
      selectQueue: [[bugLabel], [{ labelId: 'lbl_bug' }]],
      // labels insert → "frontend" created
      insertReturningQueue: [[frontendLabel]],
    });
    dbTransactionMock.mockImplementation(async (cb: (tx: Executor) => Promise<unknown>) =>
      cb(executor)
    );

    const result = await syncIssueLabels({
      organizationId: 'org_1',
      issueId: 'iss_1',
      labels: ['bug', 'frontend'],
      createdBy: 'user_1',
    });

    expect(dbTransactionMock).toHaveBeenCalledTimes(1);
    expect(result.map((l) => l.id)).toEqual(['lbl_bug', 'lbl_frontend']);

    // Stale junction rows removed via notInArray over the resolved label ids.
    expect(calls.deletes).toHaveLength(1);
    const deleteClause = calls.deletes[0]!;
    expect(deleteClause.type).toBe('and');
    const notIn = (deleteClause.args as MockClause[]).find((c) => c.type === 'notInArray');
    expect(notIn?.right).toEqual(['lbl_bug', 'lbl_frontend']);

    // Junction insert: only the NEW link, with organization_id stamped.
    const junctionInsert = calls.inserts[1];
    expect(junctionInsert?.values).toEqual([
      { issueId: 'iss_1', labelId: 'lbl_frontend', organizationId: 'org_1' },
    ]);
  });

  it('clears all junction rows when the label set is empty', async () => {
    const { executor, calls } = createFakeExecutor({ selectQueue: [] });
    dbTransactionMock.mockImplementation(async (cb: (tx: Executor) => Promise<unknown>) =>
      cb(executor)
    );

    const result = await syncIssueLabels({
      organizationId: 'org_1',
      issueId: 'iss_1',
      labels: [],
    });

    expect(result).toEqual([]);
    expect(calls.deletes).toHaveLength(1);
    // Delete is scoped to issue + org, with NO notInArray (drop everything).
    const clause = calls.deletes[0]!;
    expect(clause.type).toBe('and');
    expect((clause.args as MockClause[]).map((c) => c.type)).toEqual(['eq', 'eq']);
    expect(calls.inserts).toHaveLength(0);
  });

  it('skips no-op junction inserts when all links already exist', async () => {
    const { executor, calls } = createFakeExecutor({
      selectQueue: [[bugLabel], [{ labelId: 'lbl_bug' }]],
    });
    dbTransactionMock.mockImplementation(async (cb: (tx: Executor) => Promise<unknown>) =>
      cb(executor)
    );

    await syncIssueLabels({ organizationId: 'org_1', issueId: 'iss_1', labels: ['bug'] });

    expect(calls.inserts).toHaveLength(0);
    expect(calls.deletes).toHaveLength(1);
  });
});
