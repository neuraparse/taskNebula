import {
  ACTIVE_CALL_HEARTBEAT_STALE_MS,
  ACTIVE_CALL_JOIN_GRACE_MS,
  hasFreshHeartbeatParticipants,
  resolveActiveCallParticipantCount,
  shouldAutoEndActiveCall,
} from '@/lib/chat/call-lifecycle';

describe('chat call lifecycle helpers', () => {
  const startedAt = new Date('2026-04-04T12:00:00.000Z');

  it('ends a call immediately when the database has no remaining participants', () => {
    expect(
      shouldAutoEndActiveCall({
        databaseParticipantCount: 0,
        livekitParticipantCount: 0,
        roomExists: true,
        startedAt,
        now: new Date(startedAt.getTime() + 1_000),
      })
    ).toBe(true);
  });

  it('keeps a just-started call alive while the first participant is still joining', () => {
    expect(
      shouldAutoEndActiveCall({
        databaseParticipantCount: 1,
        livekitParticipantCount: 0,
        roomExists: true,
        startedAt,
        now: new Date(startedAt.getTime() + ACTIVE_CALL_JOIN_GRACE_MS - 1),
      })
    ).toBe(false);
  });

  it('ends a stale call when the LiveKit room is gone after the grace window', () => {
    expect(
      shouldAutoEndActiveCall({
        databaseParticipantCount: 1,
        livekitParticipantCount: 0,
        roomExists: false,
        startedAt,
        now: new Date(startedAt.getTime() + ACTIVE_CALL_JOIN_GRACE_MS + 5_000),
      })
    ).toBe(true);
  });

  it('keeps an older call alive when LiveKit still reports connected participants', () => {
    expect(
      shouldAutoEndActiveCall({
        databaseParticipantCount: 2,
        livekitParticipantCount: 1,
        roomExists: true,
        startedAt,
        now: new Date(startedAt.getTime() + ACTIVE_CALL_JOIN_GRACE_MS + 5_000),
      })
    ).toBe(false);
  });

  it('prefers the LiveKit participant count when it is available', () => {
    expect(
      resolveActiveCallParticipantCount({
        databaseParticipantCount: 3,
        livekitParticipantCount: 1,
      })
    ).toBe(1);

    expect(
      resolveActiveCallParticipantCount({
        databaseParticipantCount: 3,
        livekitParticipantCount: null,
      })
    ).toBe(3);
  });

  it('treats recent heartbeat activity as proof that the call is still occupied', () => {
    expect(
      hasFreshHeartbeatParticipants({
        databaseParticipantCount: 2,
        freshHeartbeatCount: 1,
        startedAt,
        now: new Date(startedAt.getTime() + ACTIVE_CALL_HEARTBEAT_STALE_MS + 5_000),
      })
    ).toBe(true);
  });

  it('lets a just-started call live briefly even before the first heartbeat arrives', () => {
    expect(
      hasFreshHeartbeatParticipants({
        databaseParticipantCount: 1,
        freshHeartbeatCount: 0,
        startedAt,
        now: new Date(startedAt.getTime() + ACTIVE_CALL_JOIN_GRACE_MS - 1),
      })
    ).toBe(true);
  });

  it('marks a call stale when no heartbeat remains after the grace window', () => {
    expect(
      hasFreshHeartbeatParticipants({
        databaseParticipantCount: 1,
        freshHeartbeatCount: 0,
        startedAt,
        now: new Date(startedAt.getTime() + ACTIVE_CALL_HEARTBEAT_STALE_MS + 5_000),
      })
    ).toBe(false);
  });
});
