'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export type StateGroup = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

export type ProjectRole = 'admin' | 'member' | 'guest';
export type ApproverRole = 'admin' | 'member';

export interface ProjectState {
  id: string;
  name: string;
  group: StateGroup;
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
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  saveError: string | null;
  findTransition: (fromStateId: string, toStateId: string) => TransitionRule | undefined;
  addTransition: (fromStateId: string, toStateId: string) => string;
  updateTransition: (id: string, patch: Partial<Omit<TransitionRule, 'id'>>) => void;
  removeTransition: (id: string) => void;
  save: () => Promise<WorkflowSavePayload>;
}

interface WorkflowStatusRow {
  id: string;
  name: string;
  category: 'backlog' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  color: string;
  position: number;
}

interface WorkflowTransitionRow {
  id: string;
  fromStatusId: string;
  toStatusId: string;
  conditions?: unknown;
  validators?: unknown;
  postActions?: unknown;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tr_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function mapCategoryToGroup(category: WorkflowStatusRow['category']): StateGroup {
  if (category === 'backlog') return 'backlog';
  if (category === 'done') return 'completed';
  if (category === 'blocked') return 'cancelled';
  return 'started';
}

function statusToState(status: WorkflowStatusRow): ProjectState {
  return {
    id: status.id,
    name: status.name,
    group: mapCategoryToGroup(status.category),
    color: status.color || 'gray',
  };
}

function transitionRowToRule(row: WorkflowTransitionRow): TransitionRule {
  return {
    id: row.id,
    fromStateId: row.fromStatusId,
    toStateId: row.toStatusId,
    allowedRoles: ['admin', 'member'],
    requiresApproval: false,
  };
}

async function fetchWorkflow(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}/workflow-transitions`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to load workflow');
  }
  return (await response.json()) as {
    statuses: WorkflowStatusRow[];
    transitions: WorkflowTransitionRow[];
  };
}

async function saveTransitions(projectId: string, transitions: TransitionRule[]) {
  const response = await fetch(`/api/projects/${projectId}/workflow-transitions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transitions: transitions.map((rule) => ({
        fromStatusId: rule.fromStateId,
        toStatusId: rule.toStateId,
      })),
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to save workflow transitions');
  }
  return (await response.json()) as { transitions: WorkflowTransitionRow[] };
}

export function useWorkflowBuilder(projectId: string): UseWorkflowBuilderResult {
  const t = useTranslations('projectConfig');
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['workflow-transitions', projectId],
    queryFn: () => fetchWorkflow(projectId),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });

  const [states, setStates] = useState<ProjectState[]>([]);
  const [transitions, setTransitions] = useState<TransitionRule[]>([]);

  useEffect(() => {
    if (!data) return;
    setStates(
      [...(data.statuses ?? [])]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(statusToState)
    );
    setTransitions((data.transitions ?? []).map(transitionRowToRule));
  }, [data]);

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
      const next: TransitionRule = {
        id: generateId(),
        fromStateId,
        toStateId,
        allowedRoles: ['admin', 'member'],
        requiresApproval: false,
      };
      resultId = next.id;
      return [...current, next];
    });
    return resultId;
  }, []);

  const updateTransition = useCallback((id: string, patch: Partial<Omit<TransitionRule, 'id'>>) => {
    setTransitions((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
  }, []);

  const removeTransition = useCallback((id: string) => {
    setTransitions((current) => current.filter((rule) => rule.id !== id));
  }, []);

  const mutation = useMutation({
    mutationFn: () => saveTransitions(projectId, transitions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-transitions', projectId] });
    },
  });

  const save = useCallback(async (): Promise<WorkflowSavePayload> => {
    await mutation.mutateAsync();
    return { projectId, states, transitions };
  }, [mutation, projectId, states, transitions]);

  return useMemo(
    () => ({
      projectId,
      states,
      transitions,
      isLoading,
      isSaving: mutation.isPending,
      loadError: error ? t('we_load_details_failed') : null,
      saveError: mutation.error ? t('wf_save_failed_description') : null,
      findTransition,
      addTransition,
      updateTransition,
      removeTransition,
      save,
    }),
    [
      projectId,
      states,
      transitions,
      isLoading,
      mutation.isPending,
      mutation.error,
      error,
      t,
      findTransition,
      addTransition,
      updateTransition,
      removeTransition,
      save,
    ]
  );
}

export const DEFAULT_PROJECT_STATES: readonly ProjectState[] = [];
