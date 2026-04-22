'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type ModuleStatus =
  | 'backlog'
  | 'planned'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface ProjectModule {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: ModuleStatus;
  leadId?: string;
  leadName?: string;
  startDate?: string;
  targetDate?: string;
  memberIds: string[];
  // Computed:
  totalIssues?: number;
  completedIssues?: number;
}

export interface UseModulesResult {
  modules: ProjectModule[];
  isLoading: boolean;
  createModule: (input: Omit<ProjectModule, 'id' | 'projectId'>) => ProjectModule;
  updateModule: (id: string, patch: Partial<ProjectModule>) => void;
  removeModule: (id: string) => void;
}

const MODULE_STATUSES: readonly ModuleStatus[] = [
  'backlog',
  'planned',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
] as const;

function storageKey(projectId: string): string {
  return `tn:modules:${projectId}`;
}

function isModuleStatus(value: unknown): value is ModuleStatus {
  return typeof value === 'string' && (MODULE_STATUSES as readonly string[]).includes(value);
}

function isProjectModule(value: unknown): value is ProjectModule {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ProjectModule>;
  return (
    typeof v.id === 'string' &&
    typeof v.projectId === 'string' &&
    typeof v.name === 'string' &&
    isModuleStatus(v.status) &&
    Array.isArray(v.memberIds) &&
    v.memberIds.every((m) => typeof m === 'string')
  );
}

function readFromStorage(projectId: string): ProjectModule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProjectModule);
  } catch {
    return [];
  }
}

function writeToStorage(projectId: string, modules: ProjectModule[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(modules));
  } catch {
    // Quota / serialization error — ignore silently.
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `mod_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useModules(projectId: string): UseModulesResult {
  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hydratedRef = useRef(false);

  // Hydrate from localStorage on mount / projectId change (SSR-safe).
  useEffect(() => {
    hydratedRef.current = false;
    setIsLoading(true);
    setModules(readFromStorage(projectId));
    hydratedRef.current = true;
    setIsLoading(false);
  }, [projectId]);

  // Persist on change after hydration.
  useEffect(() => {
    if (!hydratedRef.current) return;
    writeToStorage(projectId, modules);
  }, [projectId, modules]);

  // Cross-tab sync.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = storageKey(projectId);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      setModules(readFromStorage(projectId));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [projectId]);

  const createModule = useCallback<UseModulesResult['createModule']>(
    (input) => {
      const created: ProjectModule = {
        id: generateId(),
        projectId,
        name: input.name,
        description: input.description,
        status: input.status,
        leadId: input.leadId,
        leadName: input.leadName,
        startDate: input.startDate,
        targetDate: input.targetDate,
        memberIds: input.memberIds ?? [],
        totalIssues: input.totalIssues,
        completedIssues: input.completedIssues,
      };
      setModules((prev) => [created, ...prev]);
      return created;
    },
    [projectId],
  );

  const updateModule = useCallback<UseModulesResult['updateModule']>((id, patch) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              ...patch,
              id: m.id,
              projectId: m.projectId,
              memberIds: patch.memberIds ?? m.memberIds,
            }
          : m,
      ),
    );
  }, []);

  const removeModule = useCallback<UseModulesResult['removeModule']>((id) => {
    setModules((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return useMemo(
    () => ({ modules, isLoading, createModule, updateModule, removeModule }),
    [modules, isLoading, createModule, updateModule, removeModule],
  );
}
