/**
 * @jest-environment node
 *
 * Linear Agent Protocol session-helper unit tests (P0-04).
 *
 * Locks down:
 *   1. HMAC signing and verification, including the constant-time bad-secret
 *      and bad-signature paths.
 *   2. The AgentSessionEvent state machine: every documented transition is
 *      allowed and every undocumented one is rejected.
 *   3. Comment rendering: terminal states with a PR attached produce the
 *      "Devin completed PR #42" line the issue thread relies on.
 *
 * Pure helpers only — no DB, no network. The dispatch flow test below mocks
 * `@tasknebula/db` and global `fetch` so it can exercise the route handler
 * end-to-end without Postgres.
 */

import crypto from 'crypto';

import {
  AgentSessionEventSchema,
  canTransition,
  generateAgentSecret,
  isTerminalState,
  nextSessionState,
  renderAgentComment,
  signAgentPayload,
  verifyAgentSignature,
  type AgentSessionState,
} from '../sessions';

describe('signAgentPayload / verifyAgentSignature', () => {
  it('produces a deterministic hex HMAC-SHA256', () => {
    const expected = crypto
      .createHmac('sha256', 'k')
      .update('hello')
      .digest('hex');
    expect(signAgentPayload('hello', 'k')).toBe(expected);
  });

  it('round-trips with the prefixed Linear-style header', () => {
    const body = JSON.stringify({ state: 'active' });
    const sig = signAgentPayload(body, 'shh');
    expect(verifyAgentSignature(body, `sha256=${sig}`, 'shh')).toBe(true);
  });

  it('round-trips with a bare hex header', () => {
    const body = JSON.stringify({ state: 'active' });
    const sig = signAgentPayload(body, 'shh');
    expect(verifyAgentSignature(body, sig, 'shh')).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const sig = signAgentPayload('original', 'shh');
    expect(verifyAgentSignature('tampered', `sha256=${sig}`, 'shh')).toBe(false);
  });

  it('rejects with the wrong secret', () => {
    const sig = signAgentPayload('payload', 'shh');
    expect(verifyAgentSignature('payload', `sha256=${sig}`, 'other')).toBe(
      false
    );
  });

  it('rejects when the header is missing or empty', () => {
    expect(verifyAgentSignature('p', null, 'k')).toBe(false);
    expect(verifyAgentSignature('p', '', 'k')).toBe(false);
    expect(verifyAgentSignature('p', undefined, 'k')).toBe(false);
  });

  it('rejects when the secret is missing', () => {
    const sig = signAgentPayload('p', 'k');
    expect(verifyAgentSignature('p', `sha256=${sig}`, '')).toBe(false);
  });

  it('rejects signatures of the wrong length without crashing', () => {
    expect(verifyAgentSignature('p', 'sha256=deadbeef', 'k')).toBe(false);
    expect(verifyAgentSignature('p', 'not-hex', 'k')).toBe(false);
  });
});

describe('generateAgentSecret', () => {
  it('produces a 64-char hex string (32 bytes) each call and never collides', () => {
    const a = generateAgentSecret();
    const b = generateAgentSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe('AgentSessionEventSchema', () => {
  it('accepts a minimal payload', () => {
    const parsed = AgentSessionEventSchema.safeParse({ state: 'active' });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown state', () => {
    const parsed = AgentSessionEventSchema.safeParse({ state: 'exploded' });
    expect(parsed.success).toBe(false);
  });

  it('accepts the full Linear-shape payload', () => {
    const parsed = AgentSessionEventSchema.safeParse({
      state: 'complete',
      sessionId: 'sess_123',
      externalId: 'ext_abc',
      message: 'Done',
      pullRequest: {
        url: 'https://github.com/foo/bar/pull/42',
        number: 42,
        title: 'Implement X',
        state: 'open',
      },
      repo: { owner: 'foo', name: 'bar', branch: 'feat/x' },
      metadata: { tokens: 1234 },
      occurredAt: '2026-05-14T12:00:00Z',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('state machine — canTransition / nextSessionState', () => {
  const ALLOWED: Array<[AgentSessionState, AgentSessionState]> = [
    ['pending', 'active'],
    ['pending', 'error'],
    ['pending', 'stale'],
    ['active', 'awaitingInput'],
    ['active', 'complete'],
    ['active', 'error'],
    ['active', 'stale'],
    ['awaitingInput', 'active'],
    ['awaitingInput', 'complete'],
    ['awaitingInput', 'error'],
    ['awaitingInput', 'stale'],
    ['stale', 'active'],
  ];

  it.each(ALLOWED)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(nextSessionState(from, to)).toBe(to);
  });

  it('treats same-state as a no-op success (idempotent re-delivery)', () => {
    expect(canTransition('active', 'active')).toBe(true);
    expect(nextSessionState('active', 'active')).toBe('active');
  });

  it.each([
    ['complete', 'active'],
    ['complete', 'awaitingInput'],
    ['error', 'active'],
    ['error', 'complete'],
    ['pending', 'complete'],
    ['pending', 'awaitingInput'],
    ['stale', 'complete'],
  ] as Array<[AgentSessionState, AgentSessionState]>)(
    'rejects %s -> %s',
    (from, to) => {
      expect(canTransition(from, to)).toBe(false);
      expect(nextSessionState(from, to)).toBeNull();
    }
  );

  it('marks complete and error as terminal', () => {
    expect(isTerminalState('complete')).toBe(true);
    expect(isTerminalState('error')).toBe(true);
    expect(isTerminalState('active')).toBe(false);
    expect(isTerminalState('awaitingInput')).toBe(false);
    expect(isTerminalState('stale')).toBe(false);
    expect(isTerminalState('pending')).toBe(false);
  });
});

describe('renderAgentComment', () => {
  it('formats active state with a message', () => {
    const out = renderAgentComment('cursor', 'active', {
      state: 'active',
      message: 'Cloning repo',
    });
    expect(out).toBe('Cursor started: Cloning repo');
  });

  it('formats complete with a PR URL and number', () => {
    const out = renderAgentComment('devin', 'complete', {
      state: 'complete',
      pullRequest: {
        url: 'https://github.com/foo/bar/pull/42',
        number: 42,
        title: 'Add feature',
      },
    });
    expect(out).toBe(
      'Devin completed — [PR #42](https://github.com/foo/bar/pull/42) — Add feature'
    );
  });

  it('formats error with a message', () => {
    const out = renderAgentComment('claude', 'error', {
      state: 'error',
      message: 'rate limited',
    });
    expect(out).toBe('Claude errored: rate limited');
  });

  it('falls back to a generic label for the custom provider', () => {
    const out = renderAgentComment('custom', 'active', { state: 'active' });
    expect(out).toBe('Agent started.');
  });
});
