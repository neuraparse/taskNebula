/**
 * Monte Carlo ship-date forecast.
 *
 * Given a historical per-sprint throughput sample (issues completed per
 * sprint), and a remaining backlog size, we simulate `iterations` futures
 * by re-sampling throughput with replacement until the backlog is drained,
 * then report quantiles over the resulting sprint counts.
 *
 * Deterministic when seeded — important for the jest test below.
 */

export interface ForecastInput {
  /** Historical throughput per sprint (issues completed). */
  throughput: number[];
  /** Total backlog size (issues remaining) to ship. */
  backlog: number;
  /** Sprint length in days, used to convert sprint counts → ship dates. */
  sprintLengthDays?: number;
  /** Start date for the projection. Defaults to today. */
  startDate?: Date;
  /** Iterations for Monte Carlo. Defaults to 1000. */
  iterations?: number;
  /** 32-bit unsigned int seed for the PRNG. Defaults to 0xC0FFEE. */
  seed?: number;
}

export interface ForecastResult {
  p50Date: string;
  p80Date: string;
  p95Date: string;
  p50Sprints: number;
  p80Sprints: number;
  p95Sprints: number;
  iterations: number;
  histogram: { sprints: number; count: number }[];
}

/**
 * mulberry32 — small, deterministic 32-bit PRNG. Standard implementation.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const low = sorted[base] ?? 0;
  const high = sorted[base + 1];
  if (high !== undefined) {
    return low + rest * (high - low);
  }
  return low;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MAX_SPRINTS = 200;

/**
 * Run the Monte Carlo simulation. Returns p50/p80/p95 sprints needed and
 * corresponding ship dates.
 */
export function monteCarloForecast(input: ForecastInput): ForecastResult {
  const {
    throughput,
    backlog,
    sprintLengthDays = 14,
    startDate = new Date(),
    iterations = 1000,
    seed = 0xc0ffee,
  } = input;

  if (throughput.length === 0 || backlog <= 0) {
    return {
      p50Date: toISODate(startDate),
      p80Date: toISODate(startDate),
      p95Date: toISODate(startDate),
      p50Sprints: 0,
      p80Sprints: 0,
      p95Sprints: 0,
      iterations,
      histogram: [],
    };
  }

  // Defensive: bound throughput to >= 0; if all-zero, simulation can't converge.
  const cleaned = throughput.map((v) =>
    Number.isFinite(v) && v > 0 ? v : 0
  );
  const allZero = cleaned.every((v) => v === 0);

  if (allZero) {
    return {
      p50Date: 'never',
      p80Date: 'never',
      p95Date: 'never',
      p50Sprints: MAX_SPRINTS,
      p80Sprints: MAX_SPRINTS,
      p95Sprints: MAX_SPRINTS,
      iterations,
      histogram: [],
    };
  }

  const rng = mulberry32(seed);
  const results: number[] = new Array(iterations);

  for (let i = 0; i < iterations; i++) {
    let remaining = backlog;
    let sprints = 0;
    while (remaining > 0 && sprints < MAX_SPRINTS) {
      const idx = Math.floor(rng() * cleaned.length);
      const sample = cleaned[idx] ?? 0;
      remaining -= sample;
      sprints += 1;
    }
    results[i] = sprints;
  }

  const sorted = results.slice().sort((a, b) => a - b);
  const p50Sprints = Math.ceil(quantile(sorted, 0.5));
  const p80Sprints = Math.ceil(quantile(sorted, 0.8));
  const p95Sprints = Math.ceil(quantile(sorted, 0.95));

  // Build a histogram for charting.
  const counts = new Map<number, number>();
  for (const r of results) counts.set(r, (counts.get(r) ?? 0) + 1);
  const histogram = Array.from(counts.entries())
    .map(([sprints, count]) => ({ sprints, count }))
    .sort((a, b) => a.sprints - b.sprints);

  return {
    p50Date: toISODate(addDays(startDate, p50Sprints * sprintLengthDays)),
    p80Date: toISODate(addDays(startDate, p80Sprints * sprintLengthDays)),
    p95Date: toISODate(addDays(startDate, p95Sprints * sprintLengthDays)),
    p50Sprints,
    p80Sprints,
    p95Sprints,
    iterations,
    histogram,
  };
}
