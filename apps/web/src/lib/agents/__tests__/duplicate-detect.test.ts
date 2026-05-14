/**
 * @jest-environment node
 *
 * Unit tests for the duplicate-detect agent. We mock @tasknebula/db so
 * the test runs without a live Postgres connection; the embedding query
 * uses `db.execute(sql\`...\`)` which we stub to return synthetic
 * cosine-similar rows. The text fallback path is exercised by overriding
 * the same mock to throw, mirroring the "pgvector / content_embeddings
 * not yet deployed" condition.
 */

import {
  findDuplicates,
  textSimilarity,
  __internal,
} from '../duplicate-detect';

const dbMock = {
  select: jest.fn(),
  execute: jest.fn(),
};

const orderByMock = jest.fn();
const whereMock = jest.fn();
const fromMock = jest.fn();
const limitMock = jest.fn();

jest.mock('@tasknebula/db', () => ({
  __esModule: true,
  db: new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'select') return dbMock.select;
        if (prop === 'execute') return dbMock.execute;
        return undefined;
      },
    },
  ),
  desc: () => undefined,
  eq: () => undefined,
  ne: () => undefined,
  sql: ((strings: TemplateStringsArray) => ({ strings })) as any,
  issues: {
    id: 'id',
    organizationId: 'organization_id',
    title: 'title',
    description: 'description',
    createdAt: 'created_at',
    key: 'key',
  },
}));

function chainable(returnValue: any) {
  const fn = jest.fn().mockReturnThis();
  const chain: any = {
    from: fn,
    where: fn,
    orderBy: fn,
    limit: jest.fn().mockResolvedValue(returnValue),
  };
  return chain;
}

describe('textSimilarity', () => {
  it('returns 0 when both inputs have no significant tokens', () => {
    expect(textSimilarity('a', 'b')).toBe(0);
  });

  it('is symmetric and within [0, 1]', () => {
    const a = 'Login spinner stuck after SSO redirect';
    const b = 'SSO redirect login spinner never resolves';
    const ab = textSimilarity(a, b);
    const ba = textSimilarity(b, a);
    expect(ab).toBeCloseTo(ba);
    expect(ab).toBeGreaterThan(0);
    expect(ab).toBeLessThanOrEqual(1);
  });

  it('scores near-identical titles high', () => {
    const sim = textSimilarity(
      'Payment API returns 500 on checkout',
      'Payment API returns 500 on checkout',
    );
    expect(sim).toBeCloseTo(1);
  });

  it('scores unrelated titles low', () => {
    const sim = textSimilarity(
      'Login spinner stuck',
      'Quarterly revenue dashboard exports CSV',
    );
    expect(sim).toBeLessThan(0.2);
  });
});

describe('findDuplicates (embedding path with synthetic rows)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns embedding-based candidates above the potential threshold', async () => {
    // First .select() is the issue lookup → returns {id, organizationId}.
    dbMock.select.mockReturnValueOnce(
      chainable([{ id: 'iss_1', organizationId: 'org_1' }]),
    );

    dbMock.execute.mockResolvedValueOnce({
      rows: [
        {
          issue_id: 'iss_2',
          issue_key: 'ACME-2',
          title: 'Similar issue with high cosine sim',
          similarity: 0.95,
        },
        {
          issue_id: 'iss_3',
          issue_key: 'ACME-3',
          title: 'Marginal candidate',
          similarity: 0.89,
        },
      ],
    });

    const results = await findDuplicates('iss_1');
    expect(results).toHaveLength(2);
    expect(results[0].confidence).toBe('high'); // 0.95 >= 0.92
    expect(results[1].confidence).toBe('potential'); // 0.89 < 0.92
    expect(results.every((r) => r.source === 'embedding')).toBe(true);
  });

  it('parses string similarity values returned by pg drivers', async () => {
    dbMock.select.mockReturnValueOnce(
      chainable([{ id: 'iss_1', organizationId: 'org_1' }]),
    );
    dbMock.execute.mockResolvedValueOnce({
      rows: [
        {
          issue_id: 'iss_2',
          issue_key: 'ACME-2',
          title: 'Driver returns strings',
          similarity: '0.94',
        },
      ],
    });
    const results = await findDuplicates('iss_1');
    expect(results).toHaveLength(1);
    expect(results[0].similarity).toBeCloseTo(0.94);
    expect(results[0].confidence).toBe('high');
  });
});

describe('findDuplicates (text fallback when embeddings unavailable)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to text similarity when embedding query throws', async () => {
    // Source lookup
    dbMock.select.mockReturnValueOnce(
      chainable([{ id: 'iss_1', organizationId: 'org_1' }]),
    );
    // Embedding query throws (e.g. content_embeddings table missing).
    dbMock.execute.mockRejectedValueOnce(
      new Error('relation "content_embeddings" does not exist'),
    );
    // findDuplicatesByText: source body lookup
    dbMock.select.mockReturnValueOnce(
      chainable([{ title: 'Payment API returns 500 on checkout', description: null }]),
    );
    // findDuplicatesByText: candidates scan
    dbMock.select.mockReturnValueOnce(
      chainable([
        { id: 'iss_1', key: 'ACME-1', title: 'Payment API returns 500 on checkout' }, // self — filtered
        { id: 'iss_2', key: 'ACME-2', title: 'Payment API returns 500 checkout' }, // very similar
        { id: 'iss_3', key: 'ACME-3', title: 'Quarterly dashboard exports CSV' }, // unrelated
      ]),
    );

    const results = await findDuplicates('iss_1', {
      thresholds: { potential: 0.3, high: 0.7 },
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].source).toBe('text-fallback');
    expect(results[0].issueKey).toBe('ACME-2');
    expect(results.find((r) => r.issueId === 'iss_1')).toBeUndefined();
  });
});

describe('__internal.findDuplicatesByText (direct)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('respects the potential threshold', async () => {
    dbMock.select.mockReturnValueOnce(
      chainable([{ title: 'Reset password email never arrives', description: null }]),
    );
    dbMock.select.mockReturnValueOnce(
      chainable([
        { id: 'iss_target', key: 'X-1', title: 'Reset password email never arrives' },
        { id: 'iss_a', key: 'X-2', title: 'Reset password email lost in SMTP queue' },
        { id: 'iss_b', key: 'X-3', title: 'Totally unrelated billing page' },
      ]),
    );
    const out = await __internal.findDuplicatesByText('iss_target', 'org_1', 10, {
      potential: 0.3,
      high: 0.8,
    });
    expect(out.some((r) => r.issueKey === 'X-2')).toBe(true);
    expect(out.some((r) => r.issueKey === 'X-3')).toBe(false);
  });
});
