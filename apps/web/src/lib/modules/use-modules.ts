'use client';

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export type ModuleStatus =
  | 'backlog'
  | 'planned'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled';

/**
 * Client-facing module shape.
 *
 * Persisted fields (round-trip to the DB): id, projectId, name, description,
 * status, ownerId, memberIds, targetDate, createdAt, updatedAt.
 *
 * Non-persisted / derived fields (kept for UI compatibility): leadId (alias of
 * ownerId), leadName, startDate, totalIssues, completedIssues. These exist so
 * the existing dialogs and cards continue to compile — they are ignored when
 * talking to the server.
 */
export interface ProjectModule {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  status: ModuleStatus;
  ownerId?: string | null;
  memberIds: string[];
  targetDate?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // Compatibility fields (client-only, not stored server-side yet).
  leadId?: string;
  leadName?: string;
  startDate?: string;
  totalIssues?: number;
  completedIssues?: number;
}

export interface CreateModuleInput {
  name: string;
  description?: string | null;
  status?: ModuleStatus;
  ownerId?: string | null;
  memberIds?: string[];
  targetDate?: string | null;

  // Accepted but ignored by the server (kept for caller compatibility).
  leadId?: string;
  leadName?: string;
  startDate?: string;
  totalIssues?: number;
  completedIssues?: number;
}

export interface UpdateModuleInput {
  name?: string;
  description?: string | null;
  status?: ModuleStatus;
  ownerId?: string | null;
  memberIds?: string[];
  targetDate?: string | null;
}

export interface UseModulesResult {
  modules: ProjectModule[];
  isLoading: boolean;
  createModule: (input: CreateModuleInput) => Promise<ProjectModule>;
  updateModule: (id: string, patch: UpdateModuleInput) => Promise<ProjectModule>;
  removeModule: (id: string) => Promise<void>;
}

interface ServerModule {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: ModuleStatus;
  ownerId: string | null;
  memberIds: string[];
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

function toClientModule(m: ServerModule): ProjectModule {
  return {
    id: m.id,
    projectId: m.projectId,
    name: m.name,
    description: m.description,
    status: m.status,
    ownerId: m.ownerId,
    memberIds: m.memberIds ?? [],
    targetDate: m.targetDate,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    leadId: m.ownerId ?? undefined,
  };
}

function toTargetDateIso(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export const modulesQueryKey = (projectId: string) => ['project-modules', projectId] as const;

async function fetchModules(projectId: string, fetchError: string): Promise<ProjectModule[]> {
  const res = await fetch(`/api/projects/${projectId}/modules`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(fetchError);
  const data = (await res.json()) as { modules: ServerModule[] };
  return (data.modules ?? []).map(toClientModule);
}

async function postModule(
  projectId: string,
  input: CreateModuleInput,
  createError: string
): Promise<ProjectModule> {
  const res = await fetch(`/api/projects/${projectId}/modules`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? null,
      status: input.status,
      ownerId: input.ownerId ?? input.leadId ?? null,
      memberIds: input.memberIds ?? [],
      targetDate: toTargetDateIso(input.targetDate),
    }),
  });
  if (!res.ok) throw new Error(createError);
  const data = (await res.json()) as { module: ServerModule };
  return toClientModule(data.module);
}

async function patchModule(
  projectId: string,
  id: string,
  patch: UpdateModuleInput,
  updateError: string
): Promise<ProjectModule> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.ownerId !== undefined) body.ownerId = patch.ownerId;
  if (patch.memberIds !== undefined) body.memberIds = patch.memberIds;
  if (patch.targetDate !== undefined) body.targetDate = toTargetDateIso(patch.targetDate);

  const res = await fetch(`/api/projects/${projectId}/modules/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(updateError);
  const data = (await res.json()) as { module: ServerModule };
  return toClientModule(data.module);
}

async function deleteModule(projectId: string, id: string, deleteError: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/modules/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(deleteError);
}

export function useModules(projectId: string): UseModulesResult {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.modules');
  const queryKey = modulesQueryKey(projectId);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchModules(projectId, t('fetch')),
    enabled: Boolean(projectId),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateModuleInput) => postModule(projectId, input, t('create')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateModuleInput }) =>
      patchModule(projectId, id, patch, t('update')),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ProjectModule[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<ProjectModule[]>(
          queryKey,
          previous.map((m) => (m.id === id ? { ...m, ...patch } : m))
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteModule(projectId, id, t('delete')),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ProjectModule[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<ProjectModule[]>(
          queryKey,
          previous.filter((m) => m.id !== id)
        );
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const createModule = useCallback<UseModulesResult['createModule']>(
    (input) => createMutation.mutateAsync(input),
    [createMutation]
  );

  const updateModule = useCallback<UseModulesResult['updateModule']>(
    (id, patch) => updateMutation.mutateAsync({ id, patch }),
    [updateMutation]
  );

  const removeModule = useCallback<UseModulesResult['removeModule']>(
    (id) => deleteMutation.mutateAsync(id),
    [deleteMutation]
  );

  return useMemo(
    () => ({
      modules: query.data ?? [],
      isLoading: query.isLoading,
      createModule,
      updateModule,
      removeModule,
    }),
    [query.data, query.isLoading, createModule, updateModule, removeModule]
  );
}
