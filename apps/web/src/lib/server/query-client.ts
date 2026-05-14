import { cache } from 'react';
import { QueryClient } from '@tanstack/react-query';

/**
 * Per-request TanStack Query client for Server Components.
 *
 * Wrapped in React's `cache()` so every Server Component in the same RSC
 * request shares one `QueryClient` instance — this lets you fire
 * `prefetchQuery` from layouts and pages without re-fetching, then ship the
 * dehydrated state down to the client via `<HydrationBoundary>`.
 *
 * Usage pattern (streaming prefetch — do NOT await):
 *
 * ```tsx
 * // page.tsx (Server Component)
 * import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
 * import { getServerQueryClient } from '@/lib/server/query-client';
 *
 * export default function Page() {
 *   const qc = getServerQueryClient();
 *   // Kick off without await — the promise streams alongside the HTML.
 *   void qc.prefetchQuery({
 *     queryKey: ['my-issues'],
 *     queryFn: () => fetchMyIssues(),
 *   });
 *
 *   return (
 *     <HydrationBoundary state={dehydrate(qc)}>
 *       <MyIssuesClient />
 *     </HydrationBoundary>
 *   );
 * }
 * ```
 *
 * Because we don't await, the prefetch becomes a streamed promise — React
 * 19's streaming hydration lets the client `useQuery` resolve from cache
 * the moment the chunk arrives, eliminating the second client round-trip.
 */
export const getServerQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          // Match the client provider so hydrated state isn't treated as stale.
          staleTime: 60 * 1000,
        },
      },
    }),
);
