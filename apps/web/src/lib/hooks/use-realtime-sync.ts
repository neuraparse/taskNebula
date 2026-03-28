'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

interface RealtimeEvent {
  type: string;
  projectId?: string;
  sprintId?: string;
  issueId?: string;
  organizationId?: string;
  userId: string;
  timestamp: number;
}

/**
 * Hook that connects to SSE event stream and invalidates
 * relevant React Query caches when other users make changes.
 * Falls back to periodic polling when SSE is unavailable.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!session?.user) return;

    function connect() {
      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource('/api/events/stream');
      eventSourceRef.current = es;

      es.onopen = () => {
        retryCountRef.current = 0;
      };

      es.onmessage = (e) => {
        try {
          const event: RealtimeEvent = JSON.parse(e.data);
          handleEvent(event);
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        retryCountRef.current++;

        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    }

    function handleEvent(event: RealtimeEvent) {
      const { type, projectId, sprintId, issueId } = event;

      switch (type) {
        case 'issue.created':
        case 'issue.deleted':
          queryClient.invalidateQueries({ queryKey: ['issues'] });
          if (sprintId) {
            queryClient.invalidateQueries({ queryKey: ['sprint-issues', sprintId] });
          }
          if (projectId) {
            queryClient.invalidateQueries({ queryKey: ['project', projectId] });
          }
          break;

        case 'issue.updated':
          queryClient.invalidateQueries({ queryKey: ['issues'] });
          if (issueId) {
            queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
            queryClient.invalidateQueries({ queryKey: ['subtasks', issueId] });
          }
          if (sprintId) {
            queryClient.invalidateQueries({ queryKey: ['sprint-issues', sprintId] });
          }
          break;

        case 'sprint.created':
        case 'sprint.updated':
        case 'sprint.deleted':
          if (projectId) {
            queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
          }
          if (sprintId) {
            queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
            queryClient.invalidateQueries({ queryKey: ['sprint-issues', sprintId] });
          }
          break;

        case 'sprint.issues.changed':
          queryClient.invalidateQueries({ queryKey: ['issues'] });
          if (sprintId) {
            queryClient.invalidateQueries({ queryKey: ['sprint-issues', sprintId] });
            queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
          }
          break;

        case 'project.created':
        case 'project.updated':
        case 'project.deleted':
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          if (projectId) {
            queryClient.invalidateQueries({ queryKey: ['project', projectId] });
          }
          break;

        case 'member.added':
        case 'member.updated':
        case 'member.removed':
          queryClient.invalidateQueries({ queryKey: ['organization-members'] });
          queryClient.invalidateQueries({ queryKey: ['project-members'] });
          break;
      }
    }

    // Only connect when tab is visible
    if (document.visibilityState === 'visible') {
      connect();
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Reconnect and refetch stale data
        connect();
        queryClient.invalidateQueries();
      } else {
        // Disconnect when tab is hidden to save resources
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [session?.user, queryClient]);
}
