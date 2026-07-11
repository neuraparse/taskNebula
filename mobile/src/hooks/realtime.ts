import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import EventSource, { type EventSourceListener } from 'react-native-sse';

import { getAuthCookie, getBaseUrl } from '@/api/client';
import { handleRealtimeEvent, type RealtimeEvent } from '@/lib/realtime-sync';
import { useSession } from '@/stores/session';

export function useRealtimeSync(enabled: boolean): void {
  const queryClient = useQueryClient();
  const userId = useSession((s) => s.user?.id ?? null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !userId) return undefined;

    const close = () => {
      eventSourceRef.current?.removeAllEventListeners();
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };

    const connect = () => {
      const baseUrl = getBaseUrl();
      const cookie = getAuthCookie();
      if (!baseUrl || !cookie || AppState.currentState !== 'active') return;

      close();
      const stream = new EventSource(`${baseUrl}/api/events/stream`, {
        headers: {
          Accept: 'text/event-stream',
          Cookie: cookie,
        },
        pollingInterval: 5000,
        timeout: 0,
        timeoutBeforeConnection: 250,
      });

      const messageListener: EventSourceListener = (event) => {
        if (event.type !== 'message' || !event.data) return;
        try {
          handleRealtimeEvent(queryClient, JSON.parse(event.data) as RealtimeEvent);
        } catch {
          // Ignore malformed transitional payloads; the stream will keep running.
        }
      };

      const errorListener: EventSourceListener = (event) => {
        if (event.type === 'exception') {
          close();
        }
      };

      stream.addEventListener('message', messageListener);
      stream.addEventListener('error', errorListener);
      eventSourceRef.current = stream;
    };

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        connect();
        return;
      }
      close();
    };

    connect();
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      close();
    };
  }, [enabled, queryClient, userId]);
}
