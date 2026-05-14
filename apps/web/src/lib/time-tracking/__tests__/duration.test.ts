/**
 * @jest-environment node
 *
 * Duration math is load-bearing for the actual_hours rollup and the
 * `/track 30m` slash command, so we exercise the boundary cases that have
 * historically caused regressions: clock skew, fractional hours, the bare-
 * integer-means-minutes convention, and unparseable junk.
 */

import {
  computeDurationSeconds,
  formatDurationSeconds,
  parseDuration,
  secondsToHours,
} from '../duration';

describe('computeDurationSeconds', () => {
  it('returns floor seconds for a normal interval', () => {
    const start = new Date('2026-05-14T10:00:00.000Z');
    const end = new Date('2026-05-14T10:30:15.500Z');
    expect(computeDurationSeconds(start, end)).toBe(1815);
  });

  it('returns 0 when end is before start (clock skew)', () => {
    const start = new Date('2026-05-14T10:00:00Z');
    const end = new Date('2026-05-14T09:59:00Z');
    expect(computeDurationSeconds(start, end)).toBe(0);
  });

  it('returns 0 when end equals start', () => {
    const t = new Date('2026-05-14T10:00:00Z');
    expect(computeDurationSeconds(t, t)).toBe(0);
  });

  it('throws on NaN dates', () => {
    expect(() =>
      computeDurationSeconds(new Date('not-a-date'), new Date()),
    ).toThrow(RangeError);
  });
});

describe('parseDuration', () => {
  it.each<[string, number]>([
    ['30m', 1800],
    ['30 min', 1800],
    ['30 minutes', 1800],
    ['2h', 7200],
    ['2hr', 7200],
    ['1h30m', 5400],
    ['1h 30m', 5400],
    ['1.5h', 5400],
    ['45s', 45],
    // Bare integer = minutes.
    ['45', 2700],
    ['90', 5400],
  ])('parses %s', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each(['', '   ', 'banana', '0', '0m', '-5m', null as any, undefined as any])(
    'rejects bad input: %p',
    (bad) => {
      expect(parseDuration(bad)).toBeNull();
    },
  );
});

describe('formatDurationSeconds', () => {
  it.each<[number, string]>([
    [0, '0m'],
    [45, '45s'],
    [60, '1m'],
    [3600, '1h'],
    [5400, '1h 30m'],
    [3661, '1h 1m'],
  ])('formats %i → %s', (input, expected) => {
    expect(formatDurationSeconds(input)).toBe(expected);
  });

  it('handles non-finite input as zero', () => {
    expect(formatDurationSeconds(Number.NaN)).toBe('0m');
    expect(formatDurationSeconds(-1)).toBe('0m');
  });
});

describe('secondsToHours', () => {
  it('rounds to 2dp matching numeric(8,2)', () => {
    expect(secondsToHours(3600)).toBe(1);
    expect(secondsToHours(5400)).toBe(1.5);
    // 37 minutes → 0.6166… → 0.62
    expect(secondsToHours(37 * 60)).toBe(0.62);
  });

  it('returns 0 for non-positive', () => {
    expect(secondsToHours(0)).toBe(0);
    expect(secondsToHours(-100)).toBe(0);
  });
});
