import { monteCarloForecast } from '../forecast';

describe('monteCarloForecast', () => {
  it('returns deterministic quantiles for a fixed seed', () => {
    const start = new Date('2026-05-15T00:00:00Z');
    const result = monteCarloForecast({
      throughput: [8, 9, 10, 11, 12, 13],
      backlog: 60,
      sprintLengthDays: 14,
      iterations: 1000,
      seed: 42,
      startDate: start,
    });

    // Sprints-to-ship for 60 issues at ~10/sprint should land near 5-7.
    expect(result.p50Sprints).toBeGreaterThanOrEqual(5);
    expect(result.p50Sprints).toBeLessThanOrEqual(7);
    expect(result.p80Sprints).toBeGreaterThanOrEqual(result.p50Sprints);
    expect(result.p95Sprints).toBeGreaterThanOrEqual(result.p80Sprints);

    // Histogram contains exactly the iteration count.
    const total = result.histogram.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(1000);

    // Re-running with the same seed must match byte-for-byte.
    const result2 = monteCarloForecast({
      throughput: [8, 9, 10, 11, 12, 13],
      backlog: 60,
      sprintLengthDays: 14,
      iterations: 1000,
      seed: 42,
      startDate: start,
    });
    expect(result2).toEqual(result);
  });

  it('produces different distributions for different seeds', () => {
    const a = monteCarloForecast({
      throughput: [5, 7, 6, 8, 6, 7],
      backlog: 40,
      iterations: 500,
      seed: 1,
    });
    const b = monteCarloForecast({
      throughput: [5, 7, 6, 8, 6, 7],
      backlog: 40,
      iterations: 500,
      seed: 2,
    });
    expect(a.histogram).not.toEqual(b.histogram);
  });

  it('handles zero-throughput history as never-ships', () => {
    const result = monteCarloForecast({
      throughput: [0, 0, 0],
      backlog: 20,
      iterations: 100,
      seed: 7,
    });
    expect(result.p50Date).toBe('never');
    expect(result.p95Date).toBe('never');
  });

  it('returns zero work when backlog is empty', () => {
    const result = monteCarloForecast({
      throughput: [10, 10, 10],
      backlog: 0,
      iterations: 100,
      seed: 7,
    });
    expect(result.p50Sprints).toBe(0);
    expect(result.histogram).toEqual([]);
  });

  it('computes ship dates relative to startDate and sprint length', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const result = monteCarloForecast({
      throughput: [10, 10, 10, 10, 10, 10],
      backlog: 30,
      sprintLengthDays: 7,
      iterations: 200,
      seed: 99,
      startDate: start,
    });
    // 30 backlog ÷ 10 per sprint = 3 sprints × 7 days = 2026-01-22
    expect(result.p50Sprints).toBe(3);
    expect(result.p50Date).toBe('2026-01-22');
  });
});
