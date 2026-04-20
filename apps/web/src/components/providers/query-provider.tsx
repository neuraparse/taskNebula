'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { useRealtimeSync } from '@/lib/hooks/use-realtime-sync';

function RealtimeSyncProvider({ children }: { children: ReactNode }) {
  useRealtimeSync();
  return <>{children}</>;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 60 seconds - reasonable with refetchOnWindowFocus
            refetchOnWindowFocus: true,
            // No global polling - SSE handles cross-client sync
            // Individual hooks can add refetchInterval where needed
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeSyncProvider>{children}</RealtimeSyncProvider>
    </QueryClientProvider>
  );
}

