'use client';

import { createContext, useContext } from 'react';

/**
 * The entity the Sidecar is currently anchored to.
 *
 * Pages, work item views, project views, etc. should call
 * `useSidecar().setEntity(...)` on mount (and clear on unmount) so that
 * the AI panel always knows what the user is looking at.
 */
export type SidecarEntity =
  | { kind: 'work_item'; id: string; title: string; projectKey?: string }
  | { kind: 'project'; id: string; name: string }
  | { kind: 'page'; id: string; title: string }
  | { kind: 'workspace'; name: string };

export interface SidecarMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Optional chain-of-thought style trace, surfaced when "Show thinking" is on. */
  thinking?: string;
  createdAt: number;
}

export type SidecarMode = 'ask' | 'build';

export interface SidecarContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  toggle: () => void;
  entity: SidecarEntity | null;
  setEntity: (next: SidecarEntity | null) => void;
  messages: SidecarMessage[];
  sendMessage: (content: string, mode: SidecarMode) => Promise<void>;
  clear: () => void;
}

export const SidecarContext = createContext<SidecarContextValue | null>(null);

export function useSidecar(): SidecarContextValue {
  const ctx = useContext(SidecarContext);
  if (!ctx) {
    throw new Error('useSidecar must be used inside <AiSidecarProvider>');
  }
  return ctx;
}

/**
 * Convenience hook so a page/work-item view can imperatively set the entity
 * the Sidecar is anchored to. Returns the current value too.
 *
 * Usage:
 *   const { setEntity } = useSidecarContext();
 *   useEffect(() => {
 *     setEntity({ kind: 'work_item', id: issue.id, title: issue.title });
 *     return () => setEntity(null);
 *   }, [issue.id]);
 */
export function useSidecarContext(): Pick<
  SidecarContextValue,
  'entity' | 'setEntity'
> {
  const { entity, setEntity } = useSidecar();
  return { entity, setEntity };
}

/** Render-friendly label for the badge in the sidecar header. */
export function describeEntity(entity: SidecarEntity | null): string {
  if (!entity) return 'No context';
  switch (entity.kind) {
    case 'work_item':
      return entity.projectKey
        ? `${entity.projectKey}-${entity.id}`
        : entity.id;
    case 'project':
      return entity.name;
    case 'page':
      return entity.title;
    case 'workspace':
      return entity.name;
    default: {
      // Exhaustiveness guard.
      const _never: never = entity;
      return String(_never);
    }
  }
}
