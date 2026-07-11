import { analyticsBarWidth, maxBucketCount, recentBuckets, roundMetric } from './analytics';

describe('analytics helpers', () => {
  it('calculates maximum bucket counts with an empty-safe fallback', () => {
    expect(maxBucketCount([])).toBe(0);
    expect(maxBucketCount([{ count: 2 }, { count: 9 }, { count: 4 }])).toBe(9);
  });

  it('converts counts into stable chart widths', () => {
    expect(analyticsBarWidth(0, 10)).toBe(0);
    expect(analyticsBarWidth(1, 100)).toBe(6);
    expect(analyticsBarWidth(7, 10)).toBe(70);
    expect(analyticsBarWidth(20, 10)).toBe(100);
  });

  it('returns the latest buckets and rounds metric values', () => {
    expect(recentBuckets([1, 2, 3, 4], 2)).toEqual([3, 4]);
    expect(recentBuckets([1, 2], 0)).toEqual([]);
    expect(roundMetric(12.345, 1)).toBe(12.3);
    expect(roundMetric(12.345, 2)).toBe(12.35);
  });
});
