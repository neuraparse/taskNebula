import { computeTimeInStatus, StatusHistoryRow } from '../time-in-status';

const HOUR = 3600;

function row(toStatus: string, fromStatus: string | null, changedAt: string): StatusHistoryRow {
  return { toStatus, fromStatus, changedAt: new Date(changedAt) };
}

describe('computeTimeInStatus', () => {
  it('returns an empty array for issues with no history', () => {
    expect(computeTimeInStatus([])).toEqual([]);
  });

  it('aggregates durations across a linear backlog → in_progress → done flow', () => {
    // 09:00 backlog → 10:00 in_progress → 12:00 done. Eval at 13:00.
    const history = [
      row('backlog', null, '2026-05-14T09:00:00Z'),
      row('in_progress', 'backlog', '2026-05-14T10:00:00Z'),
      row('done', 'in_progress', '2026-05-14T12:00:00Z'),
    ];
    const out = computeTimeInStatus(history, new Date('2026-05-14T13:00:00Z'));
    const byStatus = Object.fromEntries(out.map((b) => [b.status, b]));

    expect(byStatus.backlog.totalDurationSeconds).toBe(HOUR);
    expect(byStatus.backlog.exitCount).toBe(1);

    expect(byStatus.in_progress.totalDurationSeconds).toBe(2 * HOUR);
    expect(byStatus.in_progress.exitCount).toBe(1);

    // done is still open for 1h
    expect(byStatus.done.totalDurationSeconds).toBe(HOUR);
    expect(byStatus.done.exitCount).toBe(0);
    expect(byStatus.done.enteredAtLast?.toISOString()).toBe('2026-05-14T12:00:00.000Z');
  });

  it('sums multiple visits to the same status', () => {
    // backlog → in_progress → backlog → in_progress (still open at eval).
    const history = [
      row('backlog', null, '2026-05-14T00:00:00Z'),
      row('in_progress', 'backlog', '2026-05-14T01:00:00Z'),
      row('backlog', 'in_progress', '2026-05-14T02:00:00Z'),
      row('in_progress', 'backlog', '2026-05-14T03:00:00Z'),
    ];
    const out = computeTimeInStatus(history, new Date('2026-05-14T05:00:00Z'));
    const byStatus = Object.fromEntries(out.map((b) => [b.status, b]));

    // backlog visited twice for 1h each
    expect(byStatus.backlog.totalDurationSeconds).toBe(2 * HOUR);
    expect(byStatus.backlog.exitCount).toBe(2);

    // in_progress: 1h closed + 2h open = 3h, one exit
    expect(byStatus.in_progress.totalDurationSeconds).toBe(3 * HOUR);
    expect(byStatus.in_progress.exitCount).toBe(1);
    expect(byStatus.in_progress.enteredAtLast?.toISOString()).toBe('2026-05-14T03:00:00.000Z');
  });

  it('handles out-of-order input rows by sorting first', () => {
    const history = [
      row('done', 'in_progress', '2026-05-14T12:00:00Z'),
      row('backlog', null, '2026-05-14T09:00:00Z'),
      row('in_progress', 'backlog', '2026-05-14T10:00:00Z'),
    ];
    const out = computeTimeInStatus(history, new Date('2026-05-14T12:30:00Z'));
    const byStatus = Object.fromEntries(out.map((b) => [b.status, b]));
    expect(byStatus.backlog.totalDurationSeconds).toBe(HOUR);
    expect(byStatus.in_progress.totalDurationSeconds).toBe(2 * HOUR);
    expect(byStatus.done.totalDurationSeconds).toBe(30 * 60);
  });

  it('returns buckets sorted by total duration descending', () => {
    const history = [
      row('backlog', null, '2026-05-14T00:00:00Z'),
      row('in_progress', 'backlog', '2026-05-14T00:10:00Z'),
      row('done', 'in_progress', '2026-05-14T05:00:00Z'),
    ];
    const out = computeTimeInStatus(history, new Date('2026-05-14T05:01:00Z'));
    expect(out.map((b) => b.status)).toEqual(['in_progress', 'backlog', 'done']);
  });
});
