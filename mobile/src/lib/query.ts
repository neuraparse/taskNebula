/**
 * TanStack Query client with offline-first persistence.
 *
 * - Cache persisted to MMKV (synchronous → no hydration flicker) so reads work
 *   offline across app restarts.
 * - onlineManager driven by NetInfo so mutations fired offline are *paused*
 *   (not failed) and resumed on reconnect.
 */
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { mmkvQueryStorage } from './storage';

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected));
  }),
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // keep for offline reads (>= persist maxAge)
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: mmkvQueryStorage,
  throttleTime: 2000,
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24h
  // Bump to invalidate persisted cache after breaking shape changes.
  buster: 'tn-mobile-v1',
};

export function clearMobileQueryCache(): void {
  queryClient.clear();
  persister.removeClient();
}
