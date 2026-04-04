// WebSocket server for streaming agent execution logs
// Note: This requires a custom Next.js server with WebSocket support
// For now, we'll use a simple in-memory event emitter pattern

import { EventEmitter } from 'events';

export interface AgentLogEvent {
  executionId: string;
  projectId: string;
  logIndex: number;
  type: 'stdout' | 'stderr' | 'system';
  content: string;
  timestamp: Date;
}

export interface AgentStatusEvent {
  executionId: string;
  projectId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  error?: string;
  timestamp: Date;
}

export type AgentStreamEvent =
  | { type: 'log'; data: AgentLogEvent }
  | { type: 'status'; data: AgentStatusEvent };

class AgentEventStream extends EventEmitter {
  private runClients = new Map<string, Set<(event: AgentStreamEvent) => void>>();
  private projectClients = new Map<string, Set<(event: AgentStreamEvent) => void>>();
  private adminClients = new Set<(event: AgentStreamEvent) => void>();

  private subscribeMap(
    store: Map<string, Set<(event: AgentStreamEvent) => void>>,
    key: string,
    callback: (event: AgentStreamEvent) => void
  ) {
    if (!store.has(key)) {
      store.set(key, new Set());
    }

    store.get(key)!.add(callback);

    return () => {
      store.get(key)?.delete(callback);
      if (store.get(key)?.size === 0) {
        store.delete(key);
      }
    };
  }

  subscribeRun(executionId: string, callback: (event: AgentStreamEvent) => void) {
    return this.subscribeMap(this.runClients, executionId, callback);
  }

  subscribeProject(projectId: string, callback: (event: AgentStreamEvent) => void) {
    return this.subscribeMap(this.projectClients, projectId, callback);
  }

  subscribeAdmin(callback: (event: AgentStreamEvent) => void) {
    this.adminClients.add(callback);

    return () => {
      this.adminClients.delete(callback);
    };
  }

  private publish(event: AgentStreamEvent) {
    const runCallbacks = this.runClients.get(event.data.executionId);
    runCallbacks?.forEach((callback) => callback(event));

    const projectCallbacks = this.projectClients.get(event.data.projectId);
    projectCallbacks?.forEach((callback) => callback(event));

    this.adminClients.forEach((callback) => callback(event));
  }

  broadcastLog(event: AgentLogEvent) {
    this.publish({ type: 'log', data: event });
  }

  broadcastStatus(event: AgentStatusEvent) {
    this.publish({ type: 'status', data: event });
  }

  getSubscriberCount(executionId: string): number {
    return this.runClients.get(executionId)?.size || 0;
  }
}

export const agentEventStream = new AgentEventStream();

// Helper functions for emitting events
export function emitAgentLog(
  executionId: string,
  projectId: string,
  log: Omit<AgentLogEvent, 'executionId' | 'projectId'>
) {
  agentEventStream.broadcastLog({
    executionId,
    projectId,
    ...log,
  });
}

export function emitAgentStatus(
  executionId: string,
  projectId: string,
  status: Omit<AgentStatusEvent, 'executionId' | 'projectId' | 'timestamp'>
) {
  agentEventStream.broadcastStatus({
    executionId,
    projectId,
    timestamp: new Date(),
    ...status,
  });
}
