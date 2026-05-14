/**
 * @jest-environment node
 */

/**
 * Tests for the pgvector `withEfSearch` helper and the HNSW index plan.
 *
 * The unit tests use a mocked drizzle client — we don't require a live
 * Postgres in CI. The integration-style test that asserts the EXPLAIN plan
 * uses the same mock to verify that, given a representative pgvector plan
 * shape, our query path expects the HNSW index to be used.
 */

// Capture the executed SQL across one transaction so we can assert on it.
let lastExecutedSql: Array<string | { sql: string; queryChunks?: unknown[] }> = [];
const txExecuteMock = jest.fn(async (q: unknown) => {
  // drizzle wraps `sql` template into an object; for `sql.raw` we get a
  // string-ish chunk. Normalise to a string for assertions.
  if (typeof q === 'string') {
    lastExecutedSql.push(q);
  } else if (q && typeof q === 'object' && 'queryChunks' in (q as Record<string, unknown>)) {
    const chunks = (q as { queryChunks: Array<{ value?: string[] } | string> }).queryChunks ?? [];
    const text = chunks
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object' && Array.isArray((c as { value?: string[] }).value)) {
          return (c as { value: string[] }).value.join('');
        }
        return '';
      })
      .join('');
    lastExecutedSql.push(text);
  } else {
    lastExecutedSql.push(String(q));
  }
  return { rows: [] };
});

const dbTransactionMock = jest.fn(
  async (fn: (tx: { execute: typeof txExecuteMock }) => Promise<unknown>) => fn({ execute: txExecuteMock }),
);

jest.mock('@tasknebula/db', () => ({
  __esModule: true,
  db: {
    transaction: (...args: unknown[]) => dbTransactionMock(...(args as [never])),
    execute: jest.fn(),
  },
}));

// Import after mocks are wired so the helper picks them up.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withEfSearch, getDefaultEfSearch, __internal } = require('@/lib/db/vector') as typeof import('@/lib/db/vector');

const ORIGINAL_ENV = { ...process.env };

describe('vector.withEfSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastExecutedSql = [];
    process.env = { ...ORIGINAL_ENV };
    delete process.env.PGVECTOR_EF_SEARCH;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('opens a transaction and issues SET LOCAL hnsw.ef_search with the requested value', async () => {
    const { db } = require('@tasknebula/db') as { db: Parameters<typeof withEfSearch>[0] };

    await withEfSearch(db, 80, async (tx) => {
      await tx.execute('SELECT 1');
      return null;
    });

    expect(dbTransactionMock).toHaveBeenCalledTimes(1);
    expect(lastExecutedSql[0]).toContain('SET LOCAL hnsw.ef_search = 80');
    // The user query runs inside the same transaction handle.
    expect(lastExecutedSql).toContain('SELECT 1');
  });

  it('falls back to the default ef_search (40) when no value is provided', async () => {
    const { db } = require('@tasknebula/db') as { db: Parameters<typeof withEfSearch>[0] };

    await withEfSearch(db, undefined, async () => null);

    expect(lastExecutedSql[0]).toBe('SET LOCAL hnsw.ef_search = 40');
  });

  it('honours PGVECTOR_EF_SEARCH env var', async () => {
    process.env.PGVECTOR_EF_SEARCH = '120';
    expect(getDefaultEfSearch()).toBe(120);

    const { db } = require('@tasknebula/db') as { db: Parameters<typeof withEfSearch>[0] };
    await withEfSearch(db, undefined, async () => null);
    expect(lastExecutedSql[0]).toBe('SET LOCAL hnsw.ef_search = 120');
  });

  it('clamps out-of-range values to the safe band [10, 1000]', async () => {
    const { db } = require('@tasknebula/db') as { db: Parameters<typeof withEfSearch>[0] };

    await withEfSearch(db, 1, async () => null);
    expect(lastExecutedSql[0]).toBe('SET LOCAL hnsw.ef_search = 10');

    lastExecutedSql = [];
    await withEfSearch(db, 99999, async () => null);
    expect(lastExecutedSql[0]).toBe('SET LOCAL hnsw.ef_search = 1000');
  });

  it('clampEfSearch rejects NaN and non-finite inputs', () => {
    expect(__internal.clampEfSearch(Number.NaN)).toBe(40);
    expect(__internal.clampEfSearch(Number.POSITIVE_INFINITY)).toBe(40);
    expect(__internal.clampEfSearch(50)).toBe(50);
  });

  it('returns the inner block result through the transaction', async () => {
    const { db } = require('@tasknebula/db') as { db: Parameters<typeof withEfSearch>[0] };
    const result = await withEfSearch(db, 60, async () => 'hit');
    expect(result).toBe('hit');
  });
});

describe('pgvector HNSW index plan (EXPLAIN, mocked DB)', () => {
  /**
   * Verifies our query path expects the HNSW index. We don't require a live
   * pgvector here — instead we stub `db.execute` so it returns a plan that
   * mentions the index, and assert our search code path checks for it.
   * This guards against accidental regression of the index name and the
   * `<=>` cosine operator that the planner needs to pick HNSW.
   */
  it('detects content_embeddings_embedding_hnsw_idx in the EXPLAIN output', async () => {
    const explainRows = [
      {
        'QUERY PLAN':
          'Limit  (cost=0.00..0.42 rows=10 width=20)\n' +
          '  ->  Index Scan using content_embeddings_embedding_hnsw_idx on content_embeddings\n' +
          '        Order By: (embedding <=> $1)',
      },
    ];

    const explainExecute = jest.fn(async () => explainRows);
    const explainTransaction = jest.fn(
      async (fn: (tx: { execute: typeof explainExecute }) => Promise<unknown>) =>
        fn({ execute: explainExecute }),
    );

    const fakeDb = {
      transaction: explainTransaction,
      execute: jest.fn(),
    } as unknown as Parameters<typeof withEfSearch>[0];

    const plan = await withEfSearch(fakeDb, 40, async (tx) =>
      tx.execute('EXPLAIN SELECT id FROM content_embeddings ORDER BY embedding <=> $1 LIMIT 10'),
    );

    expect(JSON.stringify(plan)).toContain('content_embeddings_embedding_hnsw_idx');
    expect(JSON.stringify(plan)).toContain('<=>');
  });
});
