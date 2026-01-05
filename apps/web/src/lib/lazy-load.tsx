'use client';

import dynamic from 'next/dynamic';
import { ComponentType, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading Fallback Component
 */
export function LoadingFallback({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}

/**
 * Lazy load a component with dynamic import
 * 
 * Usage:
 * const MyComponent = lazyLoad(() => import('./MyComponent'));
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = dynamic(importFunc, {
    loading: () => (fallback || <LoadingFallback />) as React.ReactElement,
    ssr: false,
  });

  return LazyComponent;
}

/**
 * Lazy load with Suspense wrapper
 * 
 * Usage:
 * const MyComponent = lazyLoadWithSuspense(() => import('./MyComponent'));
 */
export function lazyLoadWithSuspense<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = dynamic(importFunc, {
    ssr: false,
  });

  return function LazyComponentWithSuspense(props: any) {
    return (
      <Suspense fallback={fallback || <LoadingFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Preload a component
 * 
 * Usage:
 * preloadComponent(() => import('./MyComponent'));
 */
export function preloadComponent(importFunc: () => Promise<any>) {
  // Trigger the import but don't wait for it
  importFunc().catch((error) => {
    console.error('Failed to preload component:', error);
  });
}

/**
 * Lazy loaded components for common use cases
 *
 * Note: These are examples. Uncomment and use as needed.
 */

// Example: Analytics components (heavy charts)
// export const LazyVelocityChart = dynamic(
//   () => import('@/components/analytics/velocity-chart').then(mod => ({ default: mod.VelocityChart })),
//   { loading: () => <LoadingFallback />, ssr: false }
// );

/**
 * Route-based code splitting helpers
 */

// Preload components when hovering over links
export function usePreloadOnHover(importFunc: () => Promise<any>) {
  return {
    onMouseEnter: () => preloadComponent(importFunc),
    onTouchStart: () => preloadComponent(importFunc),
  };
}

/**
 * Intersection Observer based lazy loading
 * 
 * Load component when it enters viewport
 */
export function lazyLoadOnVisible<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options?: IntersectionObserverInit
) {
  const LazyComponent = dynamic(importFunc, {
    loading: () => <LoadingFallback />,
    ssr: false,
  });

  return function LazyComponentOnVisible(props: any) {
    return (
      <div
        className="min-h-[200px]"
        data-lazy-load
        style={{ minHeight: options?.rootMargin || '200px' }}
      >
        <LazyComponent {...props} />
      </div>
    );
  };
}

