// WebSocket server for streaming agent execution logs
// Note: This requires a custom Next.js server with WebSocket support
// For now, we'll use a simple in-memory event emitter pattern

import { EventEmitter } from 'events';

export interface AgentLogEvent {
  executionId: string;
  logIndex: number;
  type: 'stdout' | 'stderr' | 'system';
  content: string;
  timestamp: Date;
}

export interface AgentStatusEvent {
  executionId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  error?: string;
}

class AgentEventStream extends EventEmitter {
  private clients: Map<string, Set<(event: any) => void>> = new Map();

  subscribe(executionId: string, callback: (event: any) => void) {
    if (!this.clients.has(executionId)) {
      this.clients.set(executionId, new Set());
    }

    this.clients.get(executionId)!.add(callback);

    console.log(`[WebSocket] Client subscribed to execution: ${executionId}`);

    // Return unsubscribe function
    return () => {
      this.clients.get(executionId)?.delete(callback);
      if (this.clients.get(executionId)?.size === 0) {
        this.clients.delete(executionId);
      }
      console.log(`[WebSocket] Client unsubscribed from execution: ${executionId}`);
    };
  }

  broadcastLog(event: AgentLogEvent) {
    const callbacks = this.clients.get(event.executionId);
    if (callbacks) {
      callbacks.forEach((callback) => {
        callback({ type: 'log', data: event });
      });
    }
  }

  broadcastStatus(event: AgentStatusEvent) {
    const callbacks = this.clients.get(event.executionId);
    if (callbacks) {
      callbacks.forEach((callback) => {
        callback({ type: 'status', data: event });
      });
    }
  }

  getSubscriberCount(executionId: string): number {
    return this.clients.get(executionId)?.size || 0;
  }
}

export const agentEventStream = new AgentEventStream();

// Helper functions for emitting events
export function emitAgentLog(executionId: string, log: Omit<AgentLogEvent, 'executionId'>) {
  agentEventStream.broadcastLog({
    executionId,
    ...log,
  });
}

export function emitAgentStatus(executionId: string, status: Omit<AgentStatusEvent, 'executionId'>) {
  agentEventStream.broadcastStatus({
    executionId,
    ...status,
  });
}
