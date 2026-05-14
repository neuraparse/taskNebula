/**
 * @jest-environment node
 *
 * /api/webhooks/agent-session/[provider] receiver tests (P0-04).
 *
 * Covers the inbound side of the Linear Agent Protocol bridge:
 *   - 401 when the HMAC header is missing or invalid
 *   - 401 when no session can be located
 *   - 400 when the body is not a valid AgentSessionEvent
 *   - happy path: a valid signature + good transition produces a 200, posts a
 *     comment, and updates the session row
 *   - invalid transition (complete -> active) is dropped (200, no row mutation)
 *
 * As with the dispatch test, we mock `@tasknebula/db` so the route handler
 * can run without Postgres.
 */

type Row = Record<string, unknown>;

interface FakeState {
  inserted: Row[];
  updated: Array<{ table: string; set: Row }>;
  rows: Record<string, Row[]>;
}

const fake: FakeState = {
  inserted: [],
  updated: [],
  rows: {
    agent_sessions: [],
    agent_providers: [],
    issues: [],
    users: [],
    workflows: [],
    workflow_statuses: [],
  },
};

jest.mock('@tasknebula/db', () => {
  const table = (name: string) => ({ __name: name });

  const db = {
    select() {
      return {
        from(t: { __name: string }) {
          return {
            where(_c: unknown) {
              const rows = fake.rows[t.__name] ?? [];
              return {
                limit: (_n: number) =>
                  Promise.resolve(rows.slice(0, _n)),
                then: (resolve: (rows: Row[]) => unknown) =>
                  Promise.resolve(rows).then(resolve),
              };
            },
          };
        },
      };
    },
    insert(t: { __name: string }) {
      return {
        values(values: Row) {
          fake.inserted.push({ table: t.__name, ...values });
          return Promise.resolve([{ ...values, id: 'comment_1' }]);
        },
      };
    },
    update(t: { __name: string }) {
      return {
        set(values: Row) {
          fake.updated.push({ table: t.__name, set: values });
          return { where: (_c: unknown) => Promise.resolve() };
        },
      };
    },
  };

  const getIssueById = async (issueId: string) => {
    const issue = (fake.rows.issues ?? []).find((r) => r.id === issueId);
    return issue ? { ...issue, assignee: null } : null;
  };

  const createComment = async (data: Row) => {
    fake.inserted.push({ table: 'issue_comments', ...data });
    return { ...data, id: 'comment_1' };
  };

  return {
    db,
    eq: (col: unknown, value: unknown) => ({ op: 'eq', col, value }),
    and: (...args: unknown[]) => ({ op: 'and', args }),
    or: (...args: unknown[]) => ({ op: 'or', args }),
    isNull: (c: unknown) => ({ op: 'isNull', c }),
    getIssueById,
    createComment,
    agentSessions: table('agent_sessions'),
    agentProviders: table('agent_providers'),
    issues: table('issues'),
    issueComments: table('issue_comments'),
    workflows: table('workflows'),
    workflowStatuses: table('workflow_statuses'),
    users: table('users'),
  };
});

import { POST as receiveHandler } from '@/app/api/webhooks/agent-session/[provider]/route';
import { signAgentPayload } from '../sessions';

function reqWith(body: unknown, headers: Record<string, string> = {}): {
  text: () => Promise<string>;
  json: () => Promise<unknown>;
  headers: Headers;
} {
  const raw = JSON.stringify(body);
  return {
    text: () => Promise.resolve(raw),
    json: () => Promise.resolve(body),
    headers: new Headers(headers),
  };
}

function seed(
  opts: {
    sessionState?: 'pending' | 'active' | 'complete' | 'error';
    signedSecret?: string;
    workspaceSecret?: string;
  } = {}
) {
  fake.inserted = [];
  fake.updated = [];
  fake.rows.agent_sessions = [
    {
      id: 'sess_1',
      issueId: 'issue_1',
      provider: 'cursor',
      externalId: null,
      state: opts.sessionState ?? 'pending',
      signedSecret: opts.signedSecret ?? 'per-session-secret',
      payload: {},
    },
  ];
  fake.rows.agent_providers = [
    {
      id: 'prov_1',
      workspaceId: 'org_1',
      provider: 'cursor',
      hmacSecret: opts.workspaceSecret ?? 'workspace-secret',
      enabled: true,
    },
  ];
  fake.rows.issues = [
    {
      id: 'issue_1',
      organizationId: 'org_1',
      projectId: 'proj_1',
      key: 'TN-1',
      title: 'Wire agents',
      reporterId: 'user_caller',
    },
  ];
  fake.rows.users = [];
  fake.rows.workflows = [];
  fake.rows.workflow_statuses = [];
}

describe('POST /api/webhooks/agent-session/[provider]', () => {
  it('rejects unknown providers with 404', async () => {
    const res = await receiveHandler(
      reqWith({ state: 'active' }) as never,
      { params: Promise.resolve({ provider: 'bogus' }) }
    );
    expect(res.status).toBe(404);
  });

  it('rejects missing signature with 401', async () => {
    seed();
    const res = await receiveHandler(
      reqWith({ state: 'active', sessionId: 'sess_1' }, {
        'x-tasknebula-session-id': 'sess_1',
      }) as never,
      { params: Promise.resolve({ provider: 'cursor' }) }
    );
    expect(res.status).toBe(401);
  });

  it('rejects a bad signature with 401', async () => {
    seed({ signedSecret: 'real-secret' });
    const body = { state: 'active', sessionId: 'sess_1' };
    const res = await receiveHandler(
      reqWith(body, {
        'x-tasknebula-session-id': 'sess_1',
        'x-tasknebula-signature': 'sha256=deadbeef',
      }) as never,
      { params: Promise.resolve({ provider: 'cursor' }) }
    );
    expect(res.status).toBe(401);
  });

  it('rejects an invalid AgentSessionEvent body with 400', async () => {
    seed({ signedSecret: 'real-secret' });
    const body = { state: 'bogus' };
    const raw = JSON.stringify(body);
    const sig = signAgentPayload(raw, 'real-secret');
    const res = await receiveHandler(
      reqWith(body, {
        'x-tasknebula-session-id': 'sess_1',
        'x-tasknebula-signature': `sha256=${sig}`,
      }) as never,
      { params: Promise.resolve({ provider: 'cursor' }) }
    );
    expect(res.status).toBe(400);
  });

  it('happy path: signed event drives pending -> active and posts a comment', async () => {
    seed({ sessionState: 'pending', signedSecret: 'top-secret' });
    const body = {
      state: 'active',
      sessionId: 'sess_1',
      message: 'Cloning repo',
    };
    const raw = JSON.stringify(body);
    const sig = signAgentPayload(raw, 'top-secret');

    const res = await receiveHandler(
      reqWith(body, {
        'x-tasknebula-session-id': 'sess_1',
        'x-tasknebula-signature': `sha256=${sig}`,
      }) as never,
      { params: Promise.resolve({ provider: 'cursor' }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, sessionId: 'sess_1', state: 'active' });

    // Session row updated.
    const sessionUpdate = fake.updated.find((u) => u.table === 'agent_sessions');
    expect(sessionUpdate?.set).toMatchObject({ state: 'active' });

    // Comment posted on the linked issue.
    const comment = fake.inserted.find((i) => i.table === 'issue_comments');
    expect(comment?.content).toBe('Cursor started: Cloning repo');
  });

  it('drops an invalid transition (complete -> active) with 200 and no mutation', async () => {
    seed({ sessionState: 'complete', signedSecret: 'top-secret' });
    const body = { state: 'active', sessionId: 'sess_1' };
    const raw = JSON.stringify(body);
    const sig = signAgentPayload(raw, 'top-secret');

    const res = await receiveHandler(
      reqWith(body, {
        'x-tasknebula-session-id': 'sess_1',
        'x-tasknebula-signature': `sha256=${sig}`,
      }) as never,
      { params: Promise.resolve({ provider: 'cursor' }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dropped).toBe(true);
    expect(json.state).toBe('complete');
    const sessionUpdate = fake.updated.find((u) => u.table === 'agent_sessions');
    expect(sessionUpdate).toBeUndefined();
  });

  it('accepts the provider-shared workspace secret as a fallback', async () => {
    seed({
      sessionState: 'pending',
      signedSecret: 'per-session',
      workspaceSecret: 'shared-workspace',
    });
    const body = { state: 'active', sessionId: 'sess_1' };
    const raw = JSON.stringify(body);
    const sig = signAgentPayload(raw, 'shared-workspace');

    const res = await receiveHandler(
      reqWith(body, {
        'x-tasknebula-session-id': 'sess_1',
        'x-tasknebula-signature': `sha256=${sig}`,
      }) as never,
      { params: Promise.resolve({ provider: 'cursor' }) }
    );

    expect(res.status).toBe(200);
  });
});
