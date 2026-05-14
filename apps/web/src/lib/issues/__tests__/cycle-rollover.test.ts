// We only exercise the pure selection helper here; the DB-bound
// `rolloverCycle` is covered indirectly via integration in the migration
// smoke tests. The selection logic is what's most likely to regress because
// it owns the mixed open/closed filtering and the idempotency guard.

import { selectIssuesToRollover, RolloverCandidateIssue } from '../cycle-rollover';

const past = new Date('2026-05-10T00:00:00Z');
const now = new Date('2026-05-14T00:00:00Z');
const future = new Date('2026-05-20T00:00:00Z');

function mixedIssues(): RolloverCandidateIssue[] {
  return [
    { id: 'i-open-1', statusId: 's-todo', statusCategory: 'todo' },
    { id: 'i-open-2', statusId: 's-doing', statusCategory: 'in_progress' },
    { id: 'i-done-1', statusId: 's-done', statusCategory: 'done' },
    { id: 'i-cancelled-1', statusId: 's-cancel', statusCategory: 'cancelled' },
  ];
}

describe('selectIssuesToRollover', () => {
  it('refuses to roll cycles that have not ended yet', () => {
    const res = selectIssuesToRollover({
      cycleEndDate: future,
      now,
      enableAutoRollover: true,
      rolledOverAt: null,
      issuesInCycle: mixedIssues(),
    });
    expect(res.shouldRollover).toBe(false);
    expect(res.reason).toBe('cycle_not_ended');
  });

  it('refuses to roll cycles with auto-rollover disabled', () => {
    const res = selectIssuesToRollover({
      cycleEndDate: past,
      now,
      enableAutoRollover: false,
      rolledOverAt: null,
      issuesInCycle: mixedIssues(),
    });
    expect(res.shouldRollover).toBe(false);
    expect(res.reason).toBe('rollover_disabled');
  });

  it('skips cycles already processed (rolledOverAt >= cycleEndDate)', () => {
    const res = selectIssuesToRollover({
      cycleEndDate: past,
      now,
      enableAutoRollover: true,
      rolledOverAt: new Date(past.getTime() + 1000),
      issuesInCycle: mixedIssues(),
    });
    expect(res.shouldRollover).toBe(false);
    expect(res.reason).toBe('already_rolled_over');
  });

  it('moves only the non-Done / non-Cancelled issues from a mixed cycle', () => {
    const res = selectIssuesToRollover({
      cycleEndDate: past,
      now,
      enableAutoRollover: true,
      rolledOverAt: null,
      issuesInCycle: mixedIssues(),
    });
    expect(res.shouldRollover).toBe(true);
    expect(res.issuesToMove.map((i) => i.id).sort()).toEqual([
      'i-open-1',
      'i-open-2',
    ]);
  });

  it('returns shouldRollover=true even when every issue is closed (so we still mark rolled_over_at)', () => {
    const res = selectIssuesToRollover({
      cycleEndDate: past,
      now,
      enableAutoRollover: true,
      rolledOverAt: null,
      issuesInCycle: [
        { id: 'i-done-1', statusId: 's-done', statusCategory: 'done' },
        { id: 'i-done-2', statusId: 's-done', statusCategory: 'done' },
      ],
    });
    expect(res.shouldRollover).toBe(true);
    expect(res.issuesToMove).toEqual([]);
  });

  it('returns empty issuesToMove when the cycle has no issues at all', () => {
    const res = selectIssuesToRollover({
      cycleEndDate: past,
      now,
      enableAutoRollover: true,
      rolledOverAt: null,
      issuesInCycle: [],
    });
    expect(res.shouldRollover).toBe(true);
    expect(res.issuesToMove).toEqual([]);
  });
});
