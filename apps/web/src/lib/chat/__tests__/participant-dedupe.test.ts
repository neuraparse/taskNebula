/**
 * @jest-environment node
 */

import { dedupeActiveParticipantsByUserId } from '@/lib/chat/server';

describe('dedupeActiveParticipantsByUserId', () => {
  it('returns an empty list when there are no participants', () => {
    expect(dedupeActiveParticipantsByUserId([])).toEqual([]);
  });

  it('returns all participants when every user is unique', () => {
    const rows = [
      { userId: 'u1', joinedAt: new Date('2026-04-22T10:00:00Z') },
      { userId: 'u2', joinedAt: new Date('2026-04-22T10:01:00Z') },
      { userId: 'u3', joinedAt: new Date('2026-04-22T10:02:00Z') },
    ];
    expect(dedupeActiveParticipantsByUserId(rows)).toHaveLength(3);
  });

  it('collapses multiple stale rows for the same user down to the newest join', () => {
    const stale = { userId: 'u1', joinedAt: new Date('2026-04-22T10:00:00Z') };
    const fresh = { userId: 'u1', joinedAt: new Date('2026-04-22T10:05:00Z') };
    const other = { userId: 'u2', joinedAt: new Date('2026-04-22T10:02:00Z') };

    const unique = dedupeActiveParticipantsByUserId([stale, fresh, other]);

    expect(unique).toHaveLength(2);
    expect(unique.find((p) => p.userId === 'u1')?.joinedAt.toISOString()).toBe(
      '2026-04-22T10:05:00.000Z'
    );
  });

  it('preserves row-level metadata when deduping (uses the row object, not just the id)', () => {
    const stale = {
      userId: 'u1',
      joinedAt: new Date('2026-04-22T10:00:00Z'),
      metadata: { note: 'stale' },
    };
    const fresh = {
      userId: 'u1',
      joinedAt: new Date('2026-04-22T10:05:00Z'),
      metadata: { note: 'fresh' },
    };

    const [only] = dedupeActiveParticipantsByUserId([stale, fresh]);
    expect(only?.metadata).toEqual({ note: 'fresh' });
  });

  it('is deterministic regardless of input order', () => {
    const rows = [
      { userId: 'u1', joinedAt: new Date('2026-04-22T10:00:00Z') },
      { userId: 'u1', joinedAt: new Date('2026-04-22T10:05:00Z') },
      { userId: 'u1', joinedAt: new Date('2026-04-22T10:02:00Z') },
    ];

    const forward = dedupeActiveParticipantsByUserId([...rows]);
    const reversed = dedupeActiveParticipantsByUserId([...rows].reverse());

    expect(forward).toHaveLength(1);
    expect(reversed).toHaveLength(1);
    expect(forward[0]?.joinedAt.getTime()).toBe(reversed[0]?.joinedAt.getTime());
  });

  it('reproduces the rejoin ghost-participant scenario as a single user', () => {
    // User joins, network drops, user rejoins with a new clientSessionId.
    // The first row keeps leftAt=null because the participant-left webhook
    // can never match the new identity. Without the dedupe both rows would
    // count; with it the user is correctly reported once.
    const firstJoin = { userId: 'user-eker', joinedAt: new Date('2026-04-22T10:00:00Z') };
    const rejoin = { userId: 'user-eker', joinedAt: new Date('2026-04-22T10:00:15Z') };

    const unique = dedupeActiveParticipantsByUserId([firstJoin, rejoin]);

    expect(unique).toHaveLength(1);
    expect(unique[0]?.joinedAt).toEqual(rejoin.joinedAt);
  });
});
