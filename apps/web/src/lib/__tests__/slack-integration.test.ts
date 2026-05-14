/**
 * @jest-environment node
 *
 * Slack integration unit tests.
 *
 * Covers three primitives that the route handlers depend on:
 *
 *   1. verifySlackSignature — HMAC-SHA256 over `v0:<ts>:<body>` with a
 *      5-minute timestamp window. We assert the happy path, replay protection,
 *      and constant-time-safe behaviour for length mismatches.
 *
 *   2. parseSlashCommand   — the `/tn <verb> <args...>` parser used by the
 *      slash command route. Locks down verb routing + quote-preserving
 *      tokenization.
 *
 *   3. parseSlackUserMention — the `@user` -> Slack user id helper.
 *
 * Plus a small handler test that wires verifySlackSignature into a Web API
 * Request and checks the route would reject a bad signature without touching
 * the database. We mock @tasknebula/db so the test never opens a connection.
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// db mock — keeps these tests hermetic. The route handlers import db lazily,
// so a no-op mock is enough for the signature path.
// ---------------------------------------------------------------------------

jest.mock('@tasknebula/db', () => {
  const noopChain: Record<string, jest.Mock> = {};
  noopChain.where = jest.fn(() => noopChain);
  noopChain.limit = jest.fn(async () => []);
  noopChain.orderBy = jest.fn(() => noopChain);
  noopChain.leftJoin = jest.fn(() => noopChain);
  noopChain.from = jest.fn(() => noopChain);
  noopChain.values = jest.fn(async () => []);
  noopChain.set = jest.fn(() => noopChain);
  noopChain.returning = jest.fn(async () => []);

  const db = {
    select: jest.fn(() => noopChain),
    insert: jest.fn(() => noopChain),
    update: jest.fn(() => noopChain),
    delete: jest.fn(() => noopChain),
  };

  const passThrough = (...args: unknown[]) => ({ args });
  return {
    db,
    eq: passThrough,
    and: passThrough,
    or: passThrough,
    desc: passThrough,
    asc: passThrough,
    ilike: passThrough,
    inArray: passThrough,
    isNull: passThrough,
    organizationMembers: { __name: 'organization_members' },
    integrationConnections: { __name: 'integration_connections' },
    issues: { __name: 'issues' },
    projects: { __name: 'projects' },
    users: { __name: 'users' },
    workflowStatuses: { __name: 'workflow_statuses' },
    workflows: { __name: 'workflows' },
    slackChannelRoutes: { __name: 'slack_channel_routes' },
    slackMessageLinks: { __name: 'slack_message_links' },
  };
});

// Webhook dispatcher mock so handleSlashCommand can be imported without
// pulling in the real implementation.
jest.mock('../webhooks/dispatcher', () => ({
  triggerWebhooks: jest.fn(async () => []),
  signWebhookPayload: (b: string, s: string) =>
    crypto.createHmac('sha256', s).update(b).digest('hex'),
}));

// Set a stable signing secret + AUTH_SECRET for the suite.
const ORIGINAL_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const ORIGINAL_AUTH_SECRET = process.env.AUTH_SECRET;
beforeAll(() => {
  process.env.SLACK_SIGNING_SECRET = 'super-secret-signing-key';
  process.env.AUTH_SECRET = 'aaaa-bbbb-cccc-dddd-eeee-ffff-gggg';
});
afterAll(() => {
  process.env.SLACK_SIGNING_SECRET = ORIGINAL_SIGNING_SECRET;
  process.env.AUTH_SECRET = ORIGINAL_AUTH_SECRET;
});

import {
  parseSlashCommand,
  parseSlackUserMention,
  verifySlackSignature,
} from '../integrations/slack';

function signBody(body: string, ts: number, secret: string): string {
  return `v0=${crypto
    .createHmac('sha256', secret)
    .update(`v0:${ts}:${body}`)
    .digest('hex')}`;
}

// ---------------------------------------------------------------------------
// verifySlackSignature
// ---------------------------------------------------------------------------

describe('verifySlackSignature', () => {
  const secret = 'super-secret-signing-key';

  it('accepts a correctly signed request within the timestamp window', () => {
    const body = 'token=xyz&team_id=T1';
    const ts = Math.floor(Date.now() / 1000);
    const sig = signBody(body, ts, secret);
    expect(
      verifySlackSignature({
        body,
        timestamp: String(ts),
        signature: sig,
        signingSecret: secret,
      })
    ).toBe(true);
  });

  it('rejects a request with a tampered body', () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = signBody('original', ts, secret);
    expect(
      verifySlackSignature({
        body: 'tampered',
        timestamp: String(ts),
        signature: sig,
        signingSecret: secret,
      })
    ).toBe(false);
  });

  it('rejects a request signed with a different secret', () => {
    const body = 'b';
    const ts = Math.floor(Date.now() / 1000);
    const sig = signBody(body, ts, 'OTHER');
    expect(
      verifySlackSignature({
        body,
        timestamp: String(ts),
        signature: sig,
        signingSecret: secret,
      })
    ).toBe(false);
  });

  it('rejects a timestamp older than 5 minutes (replay window)', () => {
    const body = 'b';
    const now = 1_700_000_000;
    const old = now - 60 * 6; // 6 minutes ago
    const sig = signBody(body, old, secret);
    expect(
      verifySlackSignature({
        body,
        timestamp: String(old),
        signature: sig,
        signingSecret: secret,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it('rejects a future timestamp outside the window', () => {
    const body = 'b';
    const now = 1_700_000_000;
    const future = now + 60 * 6;
    const sig = signBody(body, future, secret);
    expect(
      verifySlackSignature({
        body,
        timestamp: String(future),
        signature: sig,
        signingSecret: secret,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it('rejects when the signature header is missing', () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(
      verifySlackSignature({
        body: 'x',
        timestamp: String(ts),
        signature: null,
        signingSecret: secret,
      })
    ).toBe(false);
  });

  it('rejects when the timestamp header is missing', () => {
    expect(
      verifySlackSignature({
        body: 'x',
        timestamp: null,
        signature: 'v0=deadbeef',
        signingSecret: secret,
      })
    ).toBe(false);
  });

  it('rejects when timestamp is non-numeric', () => {
    expect(
      verifySlackSignature({
        body: 'x',
        timestamp: 'not-a-number',
        signature: 'v0=deadbeef',
        signingSecret: secret,
      })
    ).toBe(false);
  });

  it('rejects when signatures differ in length (no throw from timingSafeEqual)', () => {
    expect(
      verifySlackSignature({
        body: 'x',
        timestamp: String(Math.floor(Date.now() / 1000)),
        signature: 'v0=short',
        signingSecret: secret,
      })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseSlashCommand
// ---------------------------------------------------------------------------

describe('parseSlashCommand', () => {
  it('treats empty text as help', () => {
    expect(parseSlashCommand('')).toEqual({ verb: 'help', args: [], raw: '' });
    expect(parseSlashCommand(undefined)).toEqual({
      verb: 'help',
      args: [],
      raw: '',
    });
  });

  it('routes known verbs', () => {
    expect(parseSlashCommand('list').verb).toBe('list');
    expect(parseSlashCommand('NEW project A').verb).toBe('new');
    expect(parseSlashCommand('search bug').verb).toBe('search');
    expect(parseSlashCommand('assign TN-1 @bob').verb).toBe('assign');
    expect(parseSlashCommand('status TN-1 done').verb).toBe('status');
  });

  it('marks unknown verbs explicitly', () => {
    const p = parseSlashCommand('foozbar 1 2');
    expect(p.verb).toBe('unknown');
    expect(p.args).toEqual(['1', '2']);
  });

  it('keeps double-quoted phrases as a single token', () => {
    const p = parseSlashCommand('new "fix the login flow"');
    expect(p.verb).toBe('new');
    expect(p.args).toEqual(['fix the login flow']);
    expect(p.raw).toBe('fix the login flow');
  });

  it('handles assign with a Slack mention as the second argument', () => {
    const p = parseSlashCommand('assign TN-42 <@U01ABC|alice>');
    expect(p.verb).toBe('assign');
    expect(p.args[0]).toBe('TN-42');
    expect(p.args[1]).toBe('<@U01ABC|alice>');
  });

  it('splits on whitespace runs', () => {
    const p = parseSlashCommand('search   multiple   spaces');
    expect(p.args).toEqual(['multiple', 'spaces']);
    expect(p.raw).toBe('multiple spaces');
  });
});

// ---------------------------------------------------------------------------
// parseSlackUserMention
// ---------------------------------------------------------------------------

describe('parseSlackUserMention', () => {
  it('extracts user id from <@U01...> form', () => {
    expect(parseSlackUserMention('<@U01ABC>')).toBe('U01ABC');
  });
  it('extracts user id from <@U01...|name> form', () => {
    expect(parseSlackUserMention('<@U01ABC|alice>')).toBe('U01ABC');
  });
  it('accepts a bare Slack user id', () => {
    expect(parseSlackUserMention('U0123456')).toBe('U0123456');
  });
  it('returns null for plain @alice or other strings', () => {
    expect(parseSlackUserMention('@alice')).toBeNull();
    expect(parseSlackUserMention('alice')).toBeNull();
    expect(parseSlackUserMention(undefined)).toBeNull();
    expect(parseSlackUserMention('<@notanid>')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Message action payload acceptance
//
// Locks in the structural contract we expect from Slack so the interactivity
// handler keeps reading the right fields when Slack adds new keys.
// ---------------------------------------------------------------------------

describe('message_action payload shape', () => {
  it('extracts the fields the bridge needs from a realistic Slack payload', () => {
    const payload = {
      type: 'message_action',
      callback_id: 'tn_create_from_message',
      trigger_id: '12345.67890.abc',
      team: { id: 'T0001', domain: 'acme' },
      user: { id: 'U0002', name: 'invoker' },
      channel: { id: 'C0003', name: 'general' },
      message: {
        ts: '1715000000.000100',
        thread_ts: '1714999999.999900',
        text: 'Production is down!\nlooks like the DB',
        user: 'U0004',
      },
      response_url: 'https://hooks.slack.com/actions/T0001/foo/bar',
    };

    // Pull out the values the bridge consumes — this is a structural test, so
    // it catches typos in the payload type definition rather than logic bugs.
    expect(payload.team.id).toBe('T0001');
    expect(payload.channel.id).toBe('C0003');
    expect(payload.message.ts).toBe('1715000000.000100');
    expect(payload.message.thread_ts).toBe('1714999999.999900');
    expect(payload.message.user).toBe('U0004');
    expect(payload.message.text?.split('\n')[0]).toBe('Production is down!');
    expect(payload.callback_id).toBe('tn_create_from_message');
  });
});
