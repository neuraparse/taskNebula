/**
 * @jest-environment node
 *
 * dispatch-agent route flow test (P0-04).
 *
 * Exercises POST /api/issues/[issueId]/dispatch-agent against a mocked
 * `@tasknebula/db`, mocked `auth`, and mocked global `fetch`. Asserts:
 *   - 401 when there is no session
 *   - 422 when the workspace has no provider configured for the requested
 *     provider key
 *   - 200 on the happy path, including:
 *       * a row inserted into agent_sessions
 *       * the outbound POST hitting the provider endpoint
 *       * a valid HMAC-SHA256 header signed with the provider secret
 *       * the AgentSessionRequest envelope shape (issue snapshot,
 *         callbackUrl, sessionId)
 *
 * We swap out the route's compile-time imports via `jest.mock` so the file
 * can be required without booting Next or hitting Postgres.
 */

// ----------------------------- DB mock ------------------------------------

type Row = Record<string, unknown>;

interface FakeQuery {
  inserted: Row[];
  updated: Array<{ table: string; set: Row }>;
  // Per-table fixtures keyed by table name.
  rows: Record<string, Row[]>;
}

const fake: FakeQuery = {
  inserted: [],
  updated: [],
  rows: {
    users: [],
    issues: [],
    projects: [],
    organization_members: [],
    project_members: [],
    agent_providers: [],
    agent_sessions: [],
    workflows: [],
    workflow_statuses: [],
  },
};

jest.mock('@tasknebula/db', () => {
  const tableSentinels = {
    users: { __name: 'users' },
    issues: { __name: 'issues' },
    projects: { __name: 'projects' },
    organizationMembers: { __name: 'organization_members' },
    projectMembers: { __name: 'project_members' },
    agentProviders: { __name: 'agent_providers' },
    agentSessions: { __name: 'agent_sessions' },
    workflows: { __name: 'workflows' },
    workflowStatuses: { __name: 'workflow_statuses' },
    issueComments: { __name: 'issue_comments' },
  } as const;

  const eq = (col: unknown, value: unknown) => ({ op: 'eq', col, value });
  const and = (...args: unknown[]) => ({ op: 'and', args });

  const db = {
    select(): {
      from: (table: { __name: string }) => {
        where: (cond: unknown) => {
          limit: (n: number) => Promise<Row[]>;
          then?: (resolve: (rows: Row[]) => unknown) => Promise<unknown>;
        };
      };
    } {
      return {
        from(table) {
          return {
            where(_cond: unknown) {
              const rows = fake.rows[table.__name] ?? [];
              const result = {
                limit: (_n: number) => Promise.resolve(rows.slice(0, _n)),
                then: (resolve: (rows: Row[]) => unknown) => Promise.resolve(rows).then(resolve),
              };
              return result;
            },
          };
        },
      };
    },
    insert(table: { __name: string }) {
      return {
        values(values: Row) {
          fake.inserted.push({ table: table.__name, ...values });
          // Provide deterministic ids so the route can echo them back.
          const id = (values.id as string | undefined) ?? `gen_${fake.inserted.length}`;
          const stored: Row = { ...values, id };
          fake.rows[table.__name] = [...(fake.rows[table.__name] ?? []), stored];
          return {
            returning: () => Promise.resolve([stored]),
          };
        },
      };
    },
    update(table: { __name: string }) {
      return {
        set(values: Row) {
          fake.updated.push({ table: table.__name, set: values });
          return { where: (_c: unknown) => Promise.resolve() };
        },
      };
    },
  };

  // `getIssueById` is a query helper; the route imports it directly. Return
  // the seeded issue row plus an `assignee` join shape.
  const getIssueById = async (issueId: string) => {
    const issue = (fake.rows.issues ?? []).find((r) => r.id === issueId);
    return issue ? { ...issue, assignee: null } : null;
  };

  // Tiny project-role defaults used by the route's permission gate.
  const ROLE_DEFAULT_PERMISSIONS = {
    viewer: { canAssignIssues: false },
    developer: { canAssignIssues: true },
    product_owner: { canAssignIssues: true },
    scrum_master: { canAssignIssues: true },
    tech_lead: { canAssignIssues: true },
    qa_engineer: { canAssignIssues: false },
    designer: { canAssignIssues: false },
  } as const;

  return {
    db,
    eq,
    and,
    or: (...a: unknown[]) => ({ op: 'or', args: a }),
    isNull: (c: unknown) => ({ op: 'isNull', c }),
    getIssueById,
    ROLE_DEFAULT_PERMISSIONS,
    ...tableSentinels,
  };
});

// ------------------------- next-auth mock ---------------------------------

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

const mockResolveLocalAgentRunner = jest.fn();
const mockRunLocalAgentSession = jest.fn();

jest.mock('@/lib/agents/local-runner', () => ({
  isLocalAgentEndpoint: (endpointUrl: string | null | undefined) =>
    Boolean(endpointUrl?.startsWith('local://')),
  resolveLocalAgentRunner: (...args: unknown[]) => mockResolveLocalAgentRunner(...args),
  runLocalAgentSession: (...args: unknown[]) => mockRunLocalAgentSession(...args),
}));

// --------------------------------------------------------------------------

import { auth as authMock } from '@/auth';

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
process.env.NEXT_PUBLIC_APP_URL = 'https://tasknebula.test';

// Pull the helpers we need _after_ the mocks above so the route picks them
// up.
import { POST as dispatchHandler } from '@/app/api/issues/[issueId]/dispatch-agent/route';
import { signAgentPayload } from '../sessions';

const originalFetch = global.fetch;

function seedHappyPath(opts: { hmacSecret: string }) {
  fake.inserted = [];
  fake.updated = [];
  fake.rows.users = [
    { id: 'user_caller', isSuperAdmin: true }, // super admin short-circuits perms
  ];
  fake.rows.issues = [
    {
      id: 'issue_1',
      key: 'TN-1',
      title: 'Wire agent dispatcher',
      description: 'Build the Linear Agent Protocol bridge.',
      priority: 'high',
      labels: ['backend'],
      projectId: 'proj_1',
      organizationId: 'org_1',
      reporterId: 'user_caller',
      assigneeId: null,
      statusId: 'status_open',
    },
  ];
  fake.rows.projects = [{ id: 'proj_1', organizationId: 'org_1' }];
  fake.rows.agent_providers = [
    {
      id: 'prov_1',
      workspaceId: 'org_1',
      provider: 'cursor',
      endpointUrl: 'https://cursor.example/agents/run',
      hmacSecret: opts.hmacSecret,
      enabled: true,
    },
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  fake.inserted = [];
  fake.updated = [];
  for (const k of Object.keys(fake.rows)) fake.rows[k] = [];
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn();
  mockResolveLocalAgentRunner.mockReset();
  mockResolveLocalAgentRunner.mockReturnValue(null);
  mockRunLocalAgentSession.mockReset();
  mockRunLocalAgentSession.mockResolvedValue(undefined);
});

afterAll(() => {
  global.fetch = originalFetch;
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

function buildRequest(body: unknown): {
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  headers: Headers;
} {
  return {
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers(),
  };
}

describe('POST /api/issues/[id]/dispatch-agent', () => {
  it('returns 401 when unauthenticated', async () => {
    (authMock as unknown as jest.Mock).mockResolvedValueOnce(null);
    const res = await dispatchHandler(buildRequest({ provider: 'cursor' }) as never, {
      params: Promise.resolve({ issueId: 'issue_1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 422 when no provider is configured', async () => {
    (authMock as unknown as jest.Mock).mockResolvedValue({
      user: { id: 'user_caller' },
    });
    seedHappyPath({ hmacSecret: 'unused' });
    fake.rows.agent_providers = []; // wipe provider config

    const res = await dispatchHandler(buildRequest({ provider: 'cursor' }) as never, {
      params: Promise.resolve({ issueId: 'issue_1' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });

  it('signs the outbound dispatch and stores an agent_sessions row', async () => {
    (authMock as unknown as jest.Mock).mockResolvedValue({
      user: { id: 'user_caller' },
    });
    const hmacSecret = 'workspace-hmac';
    seedHappyPath({ hmacSecret });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 202,
      text: () => Promise.resolve('accepted'),
    });

    const res = await dispatchHandler(
      buildRequest({ provider: 'cursor', prompt_override: 'be fast' }) as never,
      { params: Promise.resolve({ issueId: 'issue_1' }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe('active');
    expect(body.callbackUrl).toBe('https://tasknebula.test/api/webhooks/agent-session/cursor');

    // The provider URL was hit exactly once with a signed body.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://cursor.example/agents/run');
    const headers = (init as RequestInit).headers as Record<string, string>;
    const rawBody = (init as RequestInit).body as string;
    const expectedSig = signAgentPayload(rawBody, hmacSecret);
    expect(headers['X-TaskNebula-Signature']).toBe(`sha256=${expectedSig}`);
    expect(headers['X-TaskNebula-Event']).toBe('agent.session.dispatch');
    expect(headers['X-TaskNebula-Session-Id']).toBe(body.sessionId);

    // The envelope carries the right Linear-compatible bits.
    const parsed = JSON.parse(rawBody);
    expect(parsed).toEqual(
      expect.objectContaining({
        sessionId: body.sessionId,
        actorUserId: 'user_caller',
        promptOverride: 'be fast',
        callbackUrl: 'https://tasknebula.test/api/webhooks/agent-session/cursor',
        issue: expect.objectContaining({
          id: 'issue_1',
          key: 'TN-1',
          title: 'Wire agent dispatcher',
          projectId: 'proj_1',
          organizationId: 'org_1',
          url: 'https://tasknebula.test/issues/issue_1',
        }),
      })
    );

    // We inserted a session row…
    const sessionInsert = fake.inserted.find((i) => i.table === 'agent_sessions');
    expect(sessionInsert).toMatchObject({
      issueId: 'issue_1',
      provider: 'cursor',
      state: 'pending',
    });
    // …and flipped it to active on the 2xx response.
    const flip = fake.updated.find((u) => u.table === 'agent_sessions');
    expect(flip?.set).toMatchObject({ state: 'active' });
  });

  it('returns 502 when the provider rejects the handoff', async () => {
    (authMock as unknown as jest.Mock).mockResolvedValue({
      user: { id: 'user_caller' },
    });
    seedHappyPath({ hmacSecret: 's' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: () => Promise.resolve('overloaded'),
    });

    const res = await dispatchHandler(buildRequest({ provider: 'cursor' }) as never, {
      params: Promise.resolve({ issueId: 'issue_1' }),
    });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.statusCode).toBe(503);

    const flip = fake.updated.find((u) => u.table === 'agent_sessions');
    expect(flip?.set).toMatchObject({ state: 'error' });
  });

  it('dispatches directly to a configured local Codex runner without webhook fetch', async () => {
    (authMock as unknown as jest.Mock).mockResolvedValue({
      user: { id: 'user_caller' },
    });
    seedHappyPath({ hmacSecret: 'unused' });
    fake.rows.agent_providers = [];
    mockResolveLocalAgentRunner.mockReturnValue({
      provider: 'codex',
      command: 'codex',
      cwd: '/srv/tasknebula',
      model: null,
      timeoutMs: 3600000,
      maxTurns: null,
      codexSandbox: 'workspace-write',
      claudePermissionMode: 'auto',
      extraArgs: [],
      source: 'env',
    });

    const res = await dispatchHandler(
      buildRequest({ provider: 'codex', prompt_override: 'open a small PR' }) as never,
      { params: Promise.resolve({ issueId: 'issue_1' }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      provider: 'codex',
      state: 'active',
      runner: 'local_cli',
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockRunLocalAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'codex', command: 'codex' }),
      expect.objectContaining({
        sessionId: body.sessionId,
        provider: 'codex',
        promptOverride: 'open a small PR',
        issue: expect.objectContaining({
          id: 'issue_1',
          key: 'TN-1',
          reporterId: 'user_caller',
        }),
      })
    );
  });
});
