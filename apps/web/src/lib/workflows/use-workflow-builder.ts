'use client';

import { useCallback, useMemo, useState } from 'react';

export type StateGroup = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

export type ProjectRole = 'admin' | 'member' | 'guest';
export type ApproverRole = 'admin' | 'member';

export interface ProjectState {
  id: string;
  name: string;
  group: StateGroup;
  /**
   * Tailwind-compatible accent color token (e.g. "gray", "amber", "emerald")
   * Used by the builder UI to render colored chips/dots.
   */
  color: string;
}

export interface TransitionRule {
  id: string;
  fromStateId: string;
  toStateId: string;
  allowedRoles: ProjectRole[];
  requiresApproval: boolean;
  approverRoles?: ApproverRole[];
  approvedTargetStateId?: string;
  rejectedTargetStateId?: string;
}

export interface WorkflowSavePayload {
  projectId: string;
  states: ProjectState[];
  transitions: TransitionRule[];
}

export interface UseWorkflowBuilderResult {
  projectId: string;
  states: ProjectState[];
  transitions: TransitionRule[];
  /**
   * Returns the existing transition between (from → to), if any.
   */
  findTransition: (fromStateId: string, toStateId: string) => TransitionRule | undefined;
  /**
   * Adds a default rule for (from → to). No-op if it already exists; in either case
   * returns the (possibly newly created) rule's id.
   */
  addTransition: (fromStateId: string, toStateId: string) => string;
  updateTransition: (id: string, patch: Partial<Omit<TransitionRule, 'id'>>) => void;
  removeTransition: (id: string) => void;
  save: () => WorkflowSavePayload;
}

const DEFAULT_STATES: ProjectState[] = [
  { id: 'state-backlog', name: 'Backlog', group: 'backlog', color: 'gray' },
  { id: 'state-todo', name: 'Todo', group: 'unstarted', color: 'slate' },
  { id: 'state-in-progress', name: 'In Progress', group: 'started', color: 'amber' },
  { id: 'state-in-review', name: 'In Review', group: 'started', color: 'blue' },
  { id: 'state-done', name: 'Done', group: 'completed', color: 'emerald' },
  { id: 'state-cancelled', name: 'Cancelled', group: 'cancelled', color: 'rose' },
];

export const DEFAULT_PROJECT_STATES: readonly ProjectState[] = DEFAULT_STATES;

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tr_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function buildDefaultRule(fromStateId: string, toStateId: string): TransitionRule {
  return {
    id: generateId(),
    fromStateId,
    toStateId,
    allowedRoles: ['admin', 'member'],
    requiresApproval: false,
  };
}

export function useWorkflowBuilder(projectId: string): UseWorkflowBuilderResult {
  // States are seeded once per mount; backend wiring later will hydrate from API.
  const [states] = useState<ProjectState[]>(() => DEFAULT_STATES.map((state) => ({ ...state })));
  const [transitions, setTransitions] = useState<TransitionRule[]>([]);

  const findTransition = useCallback(
    (fromStateId: string, toStateId: string) =>
      transitions.find((rule) => rule.fromStateId === fromStateId && rule.toStateId === toStateId),
    [transitions]
  );

  const addTransition = useCallback((fromStateId: string, toStateId: string): string => {
    let resultId = '';
    setTransitions((current) => {
      const existing = current.find(
        (rule) => rule.fromStateId === fromStateId && rule.toStateId === toStateId
      );
      if (existing) {
        resultId = existing.id;
        return current;
      }
      const next = buildDefaultRule(fromStateId, toStateId);
      resultId = next.id;
      return [...current, next];
    });
    return resultId;
  }, []);

  const updateTransition = useCallback(
    (id: string, patch: Partial<Omit<TransitionRule, 'id'>>) => {
      setTransitions((current) =>
        current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
      );
    },
    []
  );

  const removeTransition = useCallback((id: string) => {
    setTransitions((current) => current.filter((rule) => rule.id !== id));
  }, []);

  const save = useCallback((): WorkflowSavePayload => {
    const payload: WorkflowSavePayload = {
      projectId,
      states,
      transitions,
    };
    // Stub — backend wiring later.
    // eslint-disable-next-line no-console
    console.info('save', payload);
    return payload;
  }, [projectId, states, transitions]);

  return useMemo(
    () => ({
      projectId,
      states,
      transitions,
      findTransition,
      addTransition,
      updateTransition,
      removeTransition,
      save,
    }),
    [projectId, states, transitions, findTransition, addTransition, updateTransition, removeTransition, save]
  );
}
