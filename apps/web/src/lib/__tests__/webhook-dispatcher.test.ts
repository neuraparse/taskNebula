/**
 * @jest-environment node
 *
 * Webhook dispatcher tests.
 *
 * The dispatcher has three responsibilities we want to lock down:
 *   1. HMAC-SHA256 signing matches what receivers expect (the same primitive
 *      used by the test endpoint and documented for receivers).
 *   2. Subscriber selection: only active webhooks for the given org/project
 *      whose `events` array includes the trigger event are notified.
 *   3. Persistence: successful and failed deliveries each insert a row into
 *      webhook_deliveries with the correct status, and update success/failure
 *      counters on the parent webhook.
 *
 * We mock the db module so the test does not need a real Postgres. The mock
 * returns a tiny query-builder shim that records inserts/updates so we can
 * assert on them.
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// In-memory db mock
// ---------------------------------------------------------------------------

type WebhookRow = {
  id: string;
  organizationId: string;
  projectId: string | null;
  isActive: boolean;
  url: string;
  secret: string;
  events: string[];
  successCount: number;
  failureCount: number;
};

const state: {
  webhooks: WebhookRow[];
  inserted: Array<Record<string, unknown>>;
  updated: Array<{ id: string; set: Record<string, unknown> }>;
  selectFilters: { lastOrgId: string | null; lastProjectId: string | null };
} = {
  webhooks: [],
  inserted: [],
  updated: [],
  selectFilters: { lastOrgId: null, lastProjectId: null },
};

// Capture the raw conditions handed to .where() so we can introspect the
// (org, projectId) filter the dispatcher sends. We keep this loose to avoid
// reimplementing drizzle's expression semantics.
const conditionRecord: { calls: unknown[][] } = { calls: [] };

jest.mock('@tasknebula/db', () => {
  // Define table sentinels inside the factory so jest's hoisting doesn't
  // reference them before the file-level lets initialize.
  const webhooksTable = { __name: 'webhooks' };
  const webhookDeliveriesTable = { __name: 'webhook_deliveries' };

  const eq = (col: { __key: string } | unknown, value: unknown) => ({
    op: 'eq',
    col,
    value,
  });
  const isNull = (col: unknown) => ({ op: 'isNull', col });
  const and = (...args: unknown[]) => ({ op: 'and', args });
  const or = (...args: unknown[]) => ({ op: 'or', args });

  const selectChain = {
    from(table: { __name?: string }) {
      const buildResult = (rows: WebhookRow[]) => rows;
      const exec = () => {
        if (table.__name === 'webhooks') {
          // Apply org/project filtering using the recorded selectFilters.
          // (We populated those when .where() was called.)
          const { lastOrgId, lastProjectId } = state.selectFilters;
          const matching = state.webhooks.filter(
            (w) =>
              w.organizationId === lastOrgId &&
              w.isActive &&
              (lastProjectId
                ? w.projectId === lastProjectId || w.projectId === null
                : w.projectId === null)
          );
          return buildResult(matching);
        }
        return [];
      };
      const wherePromise = (cond: unknown) => {
        conditionRecord.calls.push([cond]);
        return {
          then: (resolve: (rows: WebhookRow[]) => unknown) =>
            Promise.resolve(exec()).then(resolve),
        };
      };
      return { where: wherePromise };
    },
  };

  const db = {
    select() {
      return selectChain;
    },
    insert(table: { __name?: string }) {
      return {
        values(values: Record<string, unknown>) {
          state.inserted.push({ table: table.__name, ...values });
          return Promise.resolve();
        },
      };
    },
    update(_table: { __name?: string }) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where(cond: unknown) {
              const id =
                cond &&
                typeof cond === 'object' &&
                'value' in (cond as Record<string, unknown>)
                  ? ((cond as { value: unknown }).value as string)
                  : '__unknown__';
              state.updated.push({ id, set: values });
              return Promise.resolve();
            },
          };
        },
      };
    },
  };

  return {
    db,
    webhooks: webhooksTable,
    webhookDeliveries: webhookDeliveriesTable,
    eq,
    isNull,
    and,
    or,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetState(initial: WebhookRow[]) {
  state.webhooks = initial;
  state.inserted = [];
  state.updated = [];
  state.selectFilters = { lastOrgId: null, lastProjectId: null };
  conditionRecord.calls = [];
}

// The mock above runs eq/isNull *first*, so by the time .where() is called we
// can no longer easily walk the structure to find the org id. To keep the
// test deterministic we pre-set selectFilters from the call site.
function withOrgFilter(orgId: string, projectId: string | null = null) {
  state.selectFilters = { lastOrgId: orgId, lastProjectId: projectId };
}

// Import after jest.mock so the mocked db is picked up. jest hoists mock
// definitions above all imports, so a normal ESM import here is safe.
import {
  triggerWebhooks,
  signWebhookPayload,
} from '../webhooks/dispatcher';

// ---------------------------------------------------------------------------
// fetch mock (Node 18+ uses global fetch)
// ---------------------------------------------------------------------------

const originalFetch = global.fetch;

beforeEach(() => {
  // Clear globals between tests.
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn();
});

afterAll(() => {
  global.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('signWebhookPayload', () => {
  it('produces a hex HMAC-SHA256 over the payload string', () => {
    const secret = 'shh';
    const body = JSON.stringify({ hello: 'world' });
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    expect(signWebhookPayload(body, secret)).toBe(expected);
  });

  it('changes when payload changes', () => {
    const a = signWebhookPayload('a', 'k');
    const b = signWebhookPayload('b', 'k');
    expect(a).not.toBe(b);
  });

  it('changes when secret changes', () => {
    const a = signWebhookPayload('x', 'k1');
    const b = signWebhookPayload('x', 'k2');
    expect(a).not.toBe(b);
  });
});

describe('triggerWebhooks — delivery semantics', () => {
  it('skips entirely when no subscribers match', async () => {
    resetState([]);
    withOrgFilter('org-1');

    const outcomes = await triggerWebhooks({
      organizationId: 'org-1',
      event: 'issue.created',
      payload: { issueId: 'i1' },
    });

    expect(outcomes).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(state.inserted).toHaveLength(0);
  });

  it('does not deliver to webhooks that do not subscribe to the event', async () => {
    resetState([
      {
        id: 'wh-A',
        organizationId: 'org-1',
        projectId: null,
        isActive: true,
        url: 'https://hook.example/A',
        secret: 'sA',
        events: ['issue.deleted'], // does not include issue.created
        successCount: 0,
        failureCount: 0,
      },
    ]);
    withOrgFilter('org-1');

    const outcomes = await triggerWebhooks({
      organizationId: 'org-1',
      event: 'issue.created',
      payload: { issueId: 'i1' },
    });

    expect(outcomes).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('signs the body and posts it to the webhook URL', async () => {
    const secret = 'top-secret';
    resetState([
      {
        id: 'wh-OK',
        organizationId: 'org-1',
        projectId: null,
        isActive: true,
        url: 'https://hook.example/ok',
        secret,
        events: ['issue.created', 'issue.updated'],
        successCount: 0,
        failureCount: 0,
      },
    ]);
    withOrgFilter('org-1');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('ok'),
    } as Response);

    const outcomes = await triggerWebhooks({
      organizationId: 'org-1',
      event: 'issue.created',
      payload: { issueId: 'i1' },
      actorUserId: 'user-1',
    });

    expect(outcomes).toEqual([
      expect.objectContaining({
        webhookId: 'wh-OK',
        url: 'https://hook.example/ok',
        status: 'success',
        statusCode: 200,
      }),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('https://hook.example/ok');
    const init = call[1] as RequestInit & { headers: Record<string, string> };
    expect(init.method).toBe('POST');
    expect(init.headers['X-TaskNebula-Event']).toBe('issue.created');
    expect(init.headers['X-Webhook-ID']).toBe('wh-OK');

    const body = init.body as string;
    const expectedSig = signWebhookPayload(body, secret);
    expect(init.headers['X-TaskNebula-Signature']).toBe(`sha256=${expectedSig}`);
    expect(init.headers['X-Webhook-Signature']).toBe(expectedSig);

    // Envelope shape: data carries the original payload, top level carries
    // event/orgId/actorUserId/timestamp.
    const parsed = JSON.parse(body);
    expect(parsed).toEqual(
      expect.objectContaining({
        event: 'issue.created',
        organizationId: 'org-1',
        actorUserId: 'user-1',
        data: { issueId: 'i1' },
      })
    );
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('records a delivery row and increments successCount on 2xx', async () => {
    resetState([
      {
        id: 'wh-OK',
        organizationId: 'org-1',
        projectId: null,
        isActive: true,
        url: 'https://hook.example/ok',
        secret: 'sek',
        events: ['issue.created'],
        successCount: 7,
        failureCount: 2,
      },
    ]);
    withOrgFilter('org-1');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: () => Promise.resolve(''),
    } as Response);

    await triggerWebhooks({
      organizationId: 'org-1',
      event: 'issue.created',
      payload: {},
    });

    const inserts = state.inserted.filter(
      (i) => i.table === 'webhook_deliveries'
    );
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      webhookId: 'wh-OK',
      event: 'issue.created',
      status: 'success',
      statusCode: 204,
      attemptCount: 1,
    });

    expect(state.updated).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'wh-OK',
          set: expect.objectContaining({ successCount: 8, failureCount: 2 }),
        }),
      ])
    );
  });

  it('records a failure on non-2xx and increments failureCount', async () => {
    resetState([
      {
        id: 'wh-FAIL',
        organizationId: 'org-1',
        projectId: null,
        isActive: true,
        url: 'https://hook.example/fail',
        secret: 'sek',
        events: ['issue.updated'],
        successCount: 1,
        failureCount: 1,
      },
    ]);
    withOrgFilter('org-1');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('boom'),
    } as Response);

    const outcomes = await triggerWebhooks({
      organizationId: 'org-1',
      event: 'issue.updated',
      payload: {},
    });

    expect(outcomes[0]).toMatchObject({
      status: 'failed',
      statusCode: 500,
    });

    const inserts = state.inserted.filter(
      (i) => i.table === 'webhook_deliveries'
    );
    expect(inserts[0]).toMatchObject({
      status: 'failed',
      statusCode: 500,
      errorMessage: 'HTTP 500',
    });

    expect(state.updated).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'wh-FAIL',
          set: expect.objectContaining({ successCount: 1, failureCount: 2 }),
        }),
      ])
    );
  });

  it('treats network errors as failed without throwing', async () => {
    resetState([
      {
        id: 'wh-NET',
        organizationId: 'org-1',
        projectId: null,
        isActive: true,
        url: 'https://hook.example/net',
        secret: 'sek',
        events: ['issue.created'],
        successCount: 0,
        failureCount: 0,
      },
    ]);
    withOrgFilter('org-1');

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('econnrefused'));

    const outcomes = await triggerWebhooks({
      organizationId: 'org-1',
      event: 'issue.created',
      payload: {},
    });

    expect(outcomes[0]).toMatchObject({
      status: 'failed',
      statusCode: null,
      error: 'econnrefused',
    });

    const inserts = state.inserted.filter(
      (i) => i.table === 'webhook_deliveries'
    );
    expect(inserts[0]).toMatchObject({
      status: 'failed',
      errorMessage: 'econnrefused',
    });
  });
});
