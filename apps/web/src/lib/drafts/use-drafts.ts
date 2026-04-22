'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'tn:drafts:v1';

export interface Draft {
  id: string;
  type: 'work_item' | 'page' | 'comment';
  title: string;
  body?: string;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

interface UseDraftsResult {
  drafts: Draft[];
  addDraft: (input: Partial<Draft> & { type: Draft['type'] }) => Draft;
  updateDraft: (id: string, patch: Partial<Draft>) => void;
  removeDraft: (id: string) => void;
  promoteDraft: (id: string) => Promise<void>;
}

function readFromStorage(): Draft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is Draft =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as Draft).id === 'string' &&
        typeof (d as Draft).title === 'string' &&
        typeof (d as Draft).type === 'string' &&
        typeof (d as Draft).createdAt === 'number' &&
        typeof (d as Draft).updatedAt === 'number',
    );
  } catch {
    return [];
  }
}

function writeToStorage(drafts: Draft[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Quota or serialization error — ignore silently.
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useDrafts(): UseDraftsResult {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const hydratedRef = useRef(false);

  // Hydrate from localStorage on mount (SSR-safe).
  useEffect(() => {
    setDrafts(readFromStorage());
    hydratedRef.current = true;
  }, []);

  // Persist on change after hydration.
  useEffect(() => {
    if (!hydratedRef.current) return;
    writeToStorage(drafts);
  }, [drafts]);

  // Cross-tab sync.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setDrafts(readFromStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addDraft = useCallback<UseDraftsResult['addDraft']>((input) => {
    const now = Date.now();
    const draft: Draft = {
      id: input.id ?? generateId(),
      type: input.type,
      title: input.title ?? '',
      body: input.body,
      projectId: input.projectId,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };
    setDrafts((prev) => [draft, ...prev]);
    return draft;
  }, []);

  const updateDraft = useCallback<UseDraftsResult['updateDraft']>((id, patch) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              ...patch,
              id: d.id,
              type: patch.type ?? d.type,
              createdAt: d.createdAt,
              updatedAt: Date.now(),
            }
          : d,
      ),
    );
  }, []);

  const removeDraft = useCallback<UseDraftsResult['removeDraft']>((id) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const promoteDraft = useCallback<UseDraftsResult['promoteDraft']>(
    async (_id) => {
      void _id;
      toast({
        title: 'Feature coming soon',
        description: 'Promoting drafts to real entities is not wired up yet.',
      });
    },
    [toast],
  );

  return { drafts, addDraft, updateDraft, removeDraft, promoteDraft };
}
