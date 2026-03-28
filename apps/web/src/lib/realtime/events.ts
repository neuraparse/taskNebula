/**
 * Real-time event system for cross-client synchronization.
 * Uses in-memory EventEmitter for single-instance deployments.
 * Can be extended to Redis pub/sub for multi-instance.
 */

export type RealtimeEventType =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.deleted'
  | 'sprint.created'
  | 'sprint.updated'
  | 'sprint.deleted'
  | 'sprint.issues.changed'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'member.added'
  | 'member.updated'
  | 'member.removed';

export interface RealtimeEvent {
  type: RealtimeEventType;
  projectId?: string;
  sprintId?: string;
  issueId?: string;
  organizationId?: string;
  userId: string; // who triggered the event
  timestamp: number;
}

type Listener = (event: RealtimeEvent) => void;

class RealtimeEventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: RealtimeEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Don't let one listener break others
      }
    }
  }

  get subscriberCount() {
    return this.listeners.size;
  }
}

// Singleton - shared across all API routes in the same process
export const eventBus = new RealtimeEventBus();

// Helper to publish from API routes
export function publishEvent(
  type: RealtimeEventType,
  userId: string,
  context?: Partial<Pick<RealtimeEvent, 'projectId' | 'sprintId' | 'issueId' | 'organizationId'>>
) {
  eventBus.publish({
    type,
    userId,
    timestamp: Date.now(),
    ...context,
  });
}
