export interface CountBucket {
  count: number;
}

export function maxBucketCount<T extends CountBucket>(buckets: T[]): number {
  return Math.max(0, ...buckets.map((bucket) => bucket.count));
}

export function analyticsBarWidth(value: number, max: number, minimum = 6): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(100, Math.max(minimum, Math.round((value / max) * 100)));
}

export function recentBuckets<T>(buckets: T[], limit: number): T[] {
  if (limit <= 0) return [];
  return buckets.slice(Math.max(0, buckets.length - limit));
}

export function roundMetric(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
