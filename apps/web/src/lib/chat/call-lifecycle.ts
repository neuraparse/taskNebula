export const ACTIVE_CALL_JOIN_GRACE_MS = 25_000;
export const ACTIVE_CALL_HEARTBEAT_STALE_MS = 75_000;

export function shouldAutoEndActiveCall(params: {
  databaseParticipantCount: number;
  livekitParticipantCount: number | null;
  roomExists: boolean | null;
  startedAt: Date;
  now?: Date;
  joinGraceMs?: number;
}) {
  if (params.databaseParticipantCount <= 0) {
    return true;
  }

  if (typeof params.livekitParticipantCount === 'number' && params.livekitParticipantCount > 0) {
    return false;
  }

  const now = params.now ?? new Date();
  const ageMs = Math.max(0, now.getTime() - params.startedAt.getTime());
  if (ageMs < (params.joinGraceMs ?? ACTIVE_CALL_JOIN_GRACE_MS)) {
    return false;
  }

  if (params.roomExists === false) {
    return true;
  }

  return params.livekitParticipantCount === 0;
}

export function resolveActiveCallParticipantCount(params: {
  databaseParticipantCount: number;
  livekitParticipantCount: number | null;
}) {
  return typeof params.livekitParticipantCount === 'number'
    ? params.livekitParticipantCount
    : params.databaseParticipantCount;
}

export function hasFreshHeartbeatParticipants(params: {
  databaseParticipantCount: number;
  freshHeartbeatCount: number;
  startedAt: Date;
  now?: Date;
  joinGraceMs?: number;
  heartbeatStaleMs?: number;
}) {
  if (params.databaseParticipantCount <= 0) {
    return false;
  }

  if (params.freshHeartbeatCount > 0) {
    return true;
  }

  const now = params.now ?? new Date();
  const ageMs = Math.max(0, now.getTime() - params.startedAt.getTime());
  const graceWindowMs = Math.max(
    params.joinGraceMs ?? ACTIVE_CALL_JOIN_GRACE_MS,
    params.heartbeatStaleMs ?? ACTIVE_CALL_HEARTBEAT_STALE_MS
  );

  return ageMs < graceWindowMs;
}
