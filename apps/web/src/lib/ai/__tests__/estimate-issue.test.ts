/**
 * @jest-environment node
 *
 * Covers the three branches of {@link suggestEstimateForIssue}:
 *   1. happy path with enough similar issues
 *   2. fallback to project median when neighbours < MIN_NEIGHBOURS
 *   3. "not_enough_data" when even the project has no closed hours
 *
 * We stub the two DB-touching steps via the `_testHooks` injection point so
 * the test stays a pure function exercise — no Postgres / pgvector needed.
 */

// `estimate-issue.ts` imports from `@tasknebula/db` at the top level. Even
// though our test path uses `_testHooks` (so the real DB code never runs), the
// `import` must still resolve. We stub the package surface used by the module.
jest.mock('@tasknebula/db', () => ({
  db: {},
  issues: {},
  workflowStatuses: {},
  contentEmbeddings: {},
}));

import {
  MIN_NEIGHBOURS,
  percentile,
  suggestEstimateForIssue,
  type NeighbourIssue,
} from '../estimate-issue';

describe('percentile', () => {
  it('handles empty / single', () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([7], 0.5)).toBe(7);
  });
  it('linear-interpolates between neighbours', () => {
    // sorted asc: 1, 2, 3, 4
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(percentile([1, 2, 3, 4], 0.75)).toBe(3.25);
  });
});

function makeNeighbours(hours: number[]): NeighbourIssue[] {
  return hours.map((h, i) => ({
    id: `iss_${i}`,
    key: `TN-${100 + i}`,
    title: `Mock issue ${i}`,
    actualHours: h,
    similarity: 0.9,
  }));
}

describe('suggestEstimateForIssue — happy path', () => {
  it('uses similar issues when there are enough', async () => {
    const neighbours = makeNeighbours([2, 3, 5, 5, 8]);
    const res = await suggestEstimateForIssue({
      issueId: 'iss_target',
      projectId: 'proj_1',
      _testHooks: {
        fetchNeighbours: async () => neighbours,
        fetchProjectClosedHours: async () => {
          throw new Error('project fallback should not run');
        },
      },
    });
    expect(res.reason).toBe('similar_issues');
    expect(res.sampleSize).toBe(5);
    // median(2,3,5,5,8) = 5
    expect(res.estimateHours).toBe(5);
    expect(res.p25Hours).toBe(3);
    expect(res.p75Hours).toBe(5);
    expect(res.rationale).toMatch(/Similar to/);
    expect(res.rationale).toMatch(/TN-100/);
    expect(res.neighbours).toHaveLength(5);
  });
});

describe('suggestEstimateForIssue — project median fallback', () => {
  it('falls back when fewer than MIN_NEIGHBOURS similar issues', async () => {
    expect(MIN_NEIGHBOURS).toBeGreaterThanOrEqual(2);
    const tooFew = makeNeighbours([4]); // 1 neighbour
    const res = await suggestEstimateForIssue({
      issueId: 'iss_target',
      projectId: 'proj_1',
      _testHooks: {
        fetchNeighbours: async () => tooFew,
        fetchProjectClosedHours: async () => [1, 2, 3, 4, 5, 6, 7],
      },
    });
    expect(res.reason).toBe('project_median');
    expect(res.estimateHours).toBe(4); // median 1..7 = 4
    expect(res.p25Hours).toBe(2.5);
    expect(res.p75Hours).toBe(5.5);
    expect(res.sampleSize).toBe(7);
    expect(res.rationale).toMatch(/median of 7 closed issues/);
  });

  it('falls back when neighbour fetch returns nothing', async () => {
    const res = await suggestEstimateForIssue({
      issueId: 'iss_target',
      projectId: 'proj_1',
      _testHooks: {
        fetchNeighbours: async () => [],
        fetchProjectClosedHours: async () => [2.5, 5, 7.5],
      },
    });
    expect(res.reason).toBe('project_median');
    expect(res.estimateHours).toBe(5);
  });
});

describe('suggestEstimateForIssue — not_enough_data', () => {
  it('returns null estimates when both paths have no data', async () => {
    const res = await suggestEstimateForIssue({
      issueId: 'iss_target',
      projectId: 'proj_empty',
      _testHooks: {
        fetchNeighbours: async () => [],
        fetchProjectClosedHours: async () => [],
      },
    });
    expect(res.reason).toBe('not_enough_data');
    expect(res.estimateHours).toBeNull();
    expect(res.p25Hours).toBeNull();
    expect(res.p75Hours).toBeNull();
    expect(res.sampleSize).toBe(0);
    expect(res.rationale).toMatch(/Not enough historical data/);
  });
});
