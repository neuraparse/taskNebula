import { useState, useEffect, useRef } from 'react';

export interface AgentLog {
  logIndex: number;
  type: 'stdout' | 'stderr' | 'system';
  content: string;
  timestamp: Date;
}

export function useAgentLogs(executionId: string | undefined) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!executionId) return;

    // Use Server-Sent Events (SSE) for log streaming
    const eventSource = new EventSource(`/api/agents/executions/${executionId}/logs`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[useAgentLogs] Connected to log stream');
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const log: AgentLog = JSON.parse(event.data);
        setLogs((prev) => [...prev, log]);
      } catch (err) {
        console.error('[useAgentLogs] Failed to parse log:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[useAgentLogs] Connection error:', err);
      setIsConnected(false);
      setError('Connection to log stream failed');
      eventSource.close();
    };

    return () => {
      console.log('[useAgentLogs] Disconnecting from log stream');
      eventSource.close();
    };
  }, [executionId]);

  const clearLogs = () => setLogs([]);

  return {
    logs,
    isConnected,
    error,
    clearLogs,
  };
}
