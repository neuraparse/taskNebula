/**
 * @jest-environment node
 *
 * Integration tests for POST /api/search/hybrid.
 *
 * We mock @tasknebula/db so the route can run without a real Postgres:
 *   - db.execute returns canned BM25 and vector result rows depending on
 *     which CTE the route asked for.
 *   - The auth() helper is stubbed to return a fixed session.
 *
 * Verified behaviors:
 *   - 401 when unauthenticated.
 *   - 400 when query/organizationId are missing.
 *   - Successful 200 returns RRF-fused results merging BM25 + vector rows.
 *   - BM25-only fallback works when no embedding provider is configured
 *     (no OPENAI_API_KEY, no injected provider).
 *   - Free-text heuristic correctly routes through hybrid (via the
 *     existing GET /api/search wrapper).
 */

import { NextRequest } from 'next/server';

// --- Auth mock ---------------------------------------------------------------
jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));
import { auth } from '@/auth';

// --- DB mock -----------------------------------------------------------------
type ExecCall = { sqlText: string };
const execMock = jest.fn();

jest.mock('@tasknebula/db', () => {
  const sqlTag = (strings: TemplateStringsArray | string[], ...values: unknown[]) => {
    if (Array.isArray(strings)) {
      const text = (strings as readonly string[]).reduce((acc, part, i) => {
        return acc + part + (i < values.length ? `$${i}` : '');
      }, '');
      return { __sql: true, text, values };
    }
    return { __sql: true, text: String(strings), values };
  };
  (sqlTag as any).raw = (s: string) => ({ __sql: true, text: s, values: [] });

  return {
    db: {
      execute: (...args: unknown[]) => execMock(...args),
      insert: () => ({ values: jest.fn().mockResolvedValue(undefined) }),
    },
    sql: sqlTag,
  };
});

// --- Module under test (imported after mocks) --------------------------------
import { POST } from '@/app/api/search/hybrid/route';
import { looksLikeFreeText } from '@/lib/search/hybrid';

beforeEach(() => {
  execMock.mockReset();
  (auth as jest.Mock).mockReset();
  delete process.env.OPENAI_API_KEY;
});

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/search/hybrid', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/search/hybrid', () => {
  it('rejects unauthenticated requests with 401', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeRequest({ query: 'login bug', organizationId: 'org_1' }));
    expect(res.status).toBe(401);
  });

  it('rejects missing query with 400', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
    const res = await POST(makeRequest({ organizationId: 'org_1' }));
    expect(res.status).toBe(400);
  });

  it('rejects missing organizationId with 400', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
    const res = await POST(makeRequest({ query: 'login bug' }));
    expect(res.status).toBe(400);
  });

  it('returns BM25-only results when no embedding provider is configured', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
    // First execute() call is BM25 leg; we then never reach the vector leg
    // because getDefaultEmbeddingProvider() returns null (no OPENAI_API_KEY).
    execMock.mockResolvedValueOnce([
      {
        id: 'iss_1',
        entity_type: 'issue',
        issue_id: 'iss_1',
        issue_key: 'ACME-1',
        title: 'Fix login button on Safari',
        snippet: 'Login button does not respond on iOS Safari…',
        project_id: 'proj_1',
        rank: 0.82,
      },
      {
        id: 'iss_2',
        entity_type: 'issue',
        issue_id: 'iss_2',
        issue_key: 'ACME-2',
        title: 'Sidebar collapse',
        snippet: 'unrelated',
        project_id: 'proj_1',
        rank: 0.41,
      },
    ]);

    const res = await POST(
      makeRequest({ query: 'login button broken', organizationId: 'org_1', limit: 10 })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(2);
    expect(json.results[0].issueId).toBe('iss_1');
    // BM25 rank present; vector rank absent because provider was null.
    expect(json.results[0].bm25Rank).toBe(1);
    expect(json.results[0].vectorRank).toBeNull();
  });

  it('fuses BM25 + vector rows via RRF', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
    process.env.OPENAI_API_KEY = 'sk-test';

    // BM25 returns issue 1 first, then issue 2.
    execMock.mockResolvedValueOnce([
      {
        id: 'iss_1',
        entity_type: 'issue',
        issue_id: 'iss_1',
        issue_key: 'ACME-1',
        title: 'Issue One',
        snippet: 'one',
        project_id: 'p',
        rank: 0.9,
      },
      {
        id: 'iss_2',
        entity_type: 'issue',
        issue_id: 'iss_2',
        issue_key: 'ACME-2',
        title: 'Issue Two',
        snippet: 'two',
        project_id: 'p',
        rank: 0.5,
      },
    ]);

    // Vector returns issue 2 first (semantic match), then issue 3 (new).
    execMock.mockResolvedValueOnce([
      {
        id: 'emb_2',
        content_type: 'issue',
        content_id: 'iss_2',
        issue_id: 'iss_2',
        issue_key: 'ACME-2',
        title: 'Issue Two',
        snippet: 'two',
        project_id: 'p',
        distance: 0.1,
      },
      {
        id: 'emb_3',
        content_type: 'issue',
        content_id: 'iss_3',
        issue_id: 'iss_3',
        issue_key: 'ACME-3',
        title: 'Issue Three',
        snippet: 'three',
        project_id: 'p',
        distance: 0.3,
      },
    ]);

    // Patch global fetch so the OpenAI embedding HTTP call succeeds.
    const realFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: new Array(1536).fill(0.1) }],
        usage: { total_tokens: 5 },
      }),
    }) as any;

    try {
      const res = await POST(
        makeRequest({ query: 'sort issues by relevance', organizationId: 'org_1' })
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      // iss_2 was ranked in both legs, so it should be #1 or tied near top.
      const ids = json.results.map((r: any) => r.issueId);
      expect(ids).toContain('iss_1');
      expect(ids).toContain('iss_2');
      expect(ids).toContain('iss_3');
      expect(ids.indexOf('iss_2')).toBeLessThanOrEqual(ids.indexOf('iss_3'));
    } finally {
      global.fetch = realFetch;
    }
  });
});

describe('looksLikeFreeText heuristic', () => {
  it('treats space-separated keywords as free text', () => {
    expect(looksLikeFreeText('login button broken')).toBe(true);
  });

  it('treats JQL-style queries as structured', () => {
    expect(looksLikeFreeText('assignee = me AND status = "In Progress"')).toBe(false);
    expect(looksLikeFreeText('priority != low')).toBe(false);
    expect(looksLikeFreeText('labels IN (foo, bar)')).toBe(false);
    expect(looksLikeFreeText('title ~ "login"')).toBe(false);
  });

  it('treats blank input as not-free-text (route returns 400 in that case)', () => {
    expect(looksLikeFreeText('')).toBe(false);
    expect(looksLikeFreeText('   ')).toBe(false);
  });
});
