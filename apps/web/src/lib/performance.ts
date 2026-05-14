/**
 * Performance Monitoring Utilities
 * 
 * Provides utilities for tracking and reporting performance metrics.
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

// In-memory storage for metrics (in production, send to analytics service)
const metrics: PerformanceMetric[] = [];

/**
 * Record a performance metric
 */
export function recordMetric(
  name: string,
  value: number,
  metadata?: Record<string, any>
): void {
  // QUAL-21: build the object conditionally to satisfy
  // `exactOptionalPropertyTypes`. The interface says `metadata?` (omitted),
  // not `metadata: Record<string, any> | undefined` (always present, maybe
  // undefined). Spreading only when present keeps the runtime shape correct.
  const metric: PerformanceMetric = {
    name,
    value,
    timestamp: Date.now(),
    ...(metadata !== undefined ? { metadata } : {}),
  };

  metrics.push(metric);

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${name}:`, value, metadata);
  }

  // TODO: Send to analytics service (Vercel Analytics, Google Analytics, etc.)
  // sendToAnalytics(metric);
}

/**
 * Measure execution time of a function
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    recordMetric(name, duration, metadata);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordMetric(name, duration, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Measure execution time of a synchronous function
 */
export function measure<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    recordMetric(name, duration, metadata);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordMetric(name, duration, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Create a performance timer
 */
export function createTimer(name: string, metadata?: Record<string, any>) {
  const start = performance.now();

  return {
    end: () => {
      const duration = performance.now() - start;
      recordMetric(name, duration, metadata);
      return duration;
    },
  };
}

/**
 * Track Web Vitals
 */
export function trackWebVitals() {
  if (typeof window === 'undefined') return;

  // Track Core Web Vitals
  if ('PerformanceObserver' in window) {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        recordMetric('LCP', lastEntry.startTime, {
          element: (lastEntry as any).element?.tagName,
        });
      }
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        recordMetric('FID', entry.processingStart - entry.startTime, {
          eventType: entry.name,
        });
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          recordMetric('CLS', clsValue);
        }
      });
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  }

  // Track page load time
  window.addEventListener('load', () => {
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (perfData) {
      recordMetric('PageLoad', perfData.loadEventEnd - perfData.fetchStart);
      recordMetric('DOMContentLoaded', perfData.domContentLoadedEventEnd - perfData.fetchStart);
      recordMetric('TimeToInteractive', perfData.domInteractive - perfData.fetchStart);
    }
  });
}

/**
 * Get all recorded metrics
 */
export function getMetrics(): PerformanceMetric[] {
  return [...metrics];
}

/**
 * Clear all metrics
 */
export function clearMetrics(): void {
  metrics.length = 0;
}

/**
 * Get average metric value
 */
export function getAverageMetric(name: string): number | null {
  const filtered = metrics.filter((m) => m.name === name);
  if (filtered.length === 0) return null;

  const sum = filtered.reduce((acc, m) => acc + m.value, 0);
  return sum / filtered.length;
}

