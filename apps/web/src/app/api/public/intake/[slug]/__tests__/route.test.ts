/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

// ---- Mocks must be declared before route import ----

jest.mock('@/lib/env', () => ({
  env: { NODE_ENV: 'test' },
  isTest: true,
  isDevelopment: false,
  isProduction: false,
}));

// Default: no Redis configured, so rate limit falls back to in-memory.
jest.mock('@/lib/server/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue(null),
  ensureRedisConnection: jest.fn().mockResolvedValue(null),
  isRedisConfigured: jest.fn().mockReturnValue(false),
}));

// Captcha helper: by default not configured -> verify returns true.
const isCaptchaConfiguredMock = jest.fn().mockReturnValue(false);
const verifyCaptchaMock = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/intake/captcha', () => ({
  isCaptchaConfigured: () => isCaptchaConfiguredMock(),
  verifyCaptcha: (...args: unknown[]) => verifyCaptchaMock(...args),
}));

// In-memory data the mocked `db` will surface. Tests mutate these
// between cases so each scenario reads/writes its own state.
const state: {
  forms: any[];
  projects: any[];
  workflows: any[];
  workflowStatuses: any[];
  lastIssue: any | null;
  insertedIssues: any[];
  insertedSubmissions: any[];
} = {
  forms: [],
  projects: [],
  workflows: [],
  workflowStatuses: [],
  lastIssue: null,
  insertedIssues: [],
  insertedSubmissions: [],
};

function chain(rows: unknown[]) {
  const c: any = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  };
  // Allow await on the chain itself (used in places without .limit).
  c.then = (resolve: (v: unknown) => void) => resolve(rows);
  return c;
}

jest.mock('@tasknebula/db', () => {
  let selectCallIndex = 0;
  let selectQueue: unknown[][] = [];

  const setQueue = (q: unknown[][]) => {
    selectQueue = q;
    selectCallIndex = 0;
  };

  return {
    __setSelectQueue: setQueue,
    db: {
      select: jest.fn(() => {
        const rows = selectQueue[selectCallIndex] ?? [];
        selectCallIndex += 1;
        return chain(rows);
      }),
      insert: jest.fn((table: any) => ({
        values: jest.fn((vals: any) => {
          // Discriminate by the property bag the schema export carries.
          // Reference identity isn't stable through the mock because the
          // route module gets its own copy of the mocked module exports.
          if (table?.__kind === 'intake_forms') state.forms.push(vals);
          else if (table?.__kind === 'intake_submissions') state.insertedSubmissions.push(vals);
          else if (table?.__kind === 'issues') state.insertedIssues.push(vals);
          return { returning: jest.fn().mockResolvedValue([vals]) };
        }),
      })),
    },
    intakeForms: { __kind: 'intake_forms', id: 'id', slug: 'slug', isPublic: 'isPublic' },
    intakeSubmissions: { __kind: 'intake_submissions', id: 'id', intakeFormId: 'intakeFormId' },
    issues: { __kind: 'issues', id: 'id', projectId: 'projectId', number: 'number' },
    projects: { id: 'id', organizationId: 'organizationId' },
    workflows: { id: 'id', organizationId: 'organizationId', isDefault: 'isDefault' },
    workflowStatuses: { workflowId: 'workflowId', category: 'category', position: 'position' },
  };
});

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  and: jest.fn(),
  desc: jest.fn(),
  inArray: jest.fn(),
}));

// ---- Helpers ----

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/public/intake/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as any;
}

const formFixture = {
  id: 'form_1',
  workspaceId: 'org_1',
  projectId: 'proj_1',
  slug: 'feedback',
  title: 'Feedback',
  description: 'Tell us',
  fields: [
    { name: 'summary', label: 'Summary', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email' },
  ],
  isPublic: true,
  requiresCaptcha: false,
  targetStatus: 'triage',
  autoAssignUserId: null,
  customStyling: {},
};

const projectFixture = {
  id: 'proj_1',
  organizationId: 'org_1',
  key: 'FB',
  defaultWorkflowId: 'wf_1',
  leadId: 'user_lead',
  createdBy: 'user_creator',
};

const workflowStatusFixture = {
  id: 'status_backlog',
  workflowId: 'wf_1',
  category: 'backlog',
  position: 0,
};

function queueHappyPath() {
  const db = require('@tasknebula/db');
  db.__setSelectQueue([
    [formFixture],                                  // form lookup
    [projectFixture],                               // project lookup
    [workflowStatusFixture],                        // statuses
    [{ number: 0 }],                                // last issue (for next number)
  ]);
}

// ---- Tests ----

describe('POST /api/public/intake/[slug]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state.insertedIssues.length = 0;
    state.insertedSubmissions.length = 0;
    isCaptchaConfiguredMock.mockReturnValue(false);
    verifyCaptchaMock.mockResolvedValue(true);
  });

  it('rejects 404 when slug is unknown', async () => {
    const db = require('@tasknebula/db');
    db.__setSelectQueue([[]]); // form lookup empty
    const { POST } = await import('../route');
    const res = await POST(makeRequest({ payload: { summary: 'hi' } }), {
      params: Promise.resolve({ slug: 'feedback' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 on schema validation failure (missing required field)', async () => {
    const db = require('@tasknebula/db');
    db.__setSelectQueue([[formFixture]]);
    const { POST } = await import('../route');
    const res = await POST(
      makeRequest({ payload: { email: 'a@b.com' } }), // summary missing
      { params: Promise.resolve({ slug: 'feedback' }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues?.some((i: { field: string }) => i.field === 'summary')).toBe(true);
  });

  it('skips captcha when no provider is configured even if form requires it', async () => {
    isCaptchaConfiguredMock.mockReturnValue(false);
    const db = require('@tasknebula/db');
    db.__setSelectQueue([
      [{ ...formFixture, requiresCaptcha: true }],
      [projectFixture],
      [workflowStatusFixture],
      [{ number: 0 }],
    ]);
    const { POST } = await import('../route');
    const res = await POST(
      makeRequest({ payload: { summary: 'Bug report', email: 'q@example.com' } }),
      { params: Promise.resolve({ slug: 'feedback' }) },
    );
    expect(res.status).toBe(201);
    expect(verifyCaptchaMock).not.toHaveBeenCalled();
  });

  it('creates an issue and submission on the happy path', async () => {
    queueHappyPath();
    const { POST } = await import('../route');
    const res = await POST(
      makeRequest({ payload: { summary: 'Login broken', email: 'user@example.com' } }),
      { params: Promise.resolve({ slug: 'feedback' }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.issueKey).toBe('FB-1');
    expect(state.insertedIssues).toHaveLength(1);
    expect(state.insertedSubmissions).toHaveLength(1);
    expect(state.insertedSubmissions[0].submittedByEmail).toBe('user@example.com');
    expect(state.insertedSubmissions[0].status).toBe('converted');
  });

  it('rate limits repeated submissions from the same ip', async () => {
    // The in-memory limiter (used when Redis is null) allows 5 hits per
    // minute keyed by (formId, ipHash). Re-queue the form lookup so the
    // 6th request still finds the form before hitting the limiter.
    const db = require('@tasknebula/db');
    const buildQueue = () => {
      const q: unknown[][] = [];
      for (let i = 0; i < 5; i += 1) {
        q.push([formFixture], [projectFixture], [workflowStatusFixture], [{ number: i }]);
      }
      q.push([formFixture]); // 6th request: only form lookup runs before 429
      return q;
    };
    db.__setSelectQueue(buildQueue());

    const { POST } = await import('../route');

    let lastStatus = 200;
    for (let i = 0; i < 6; i += 1) {
      const res = await POST(
        makeRequest(
          { payload: { summary: `Test ${i}` } },
          { 'x-forwarded-for': '203.0.113.10' },
        ),
        { params: Promise.resolve({ slug: 'feedback' }) },
      );
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
