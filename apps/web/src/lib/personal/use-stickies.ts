'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'tn:stickies:v1';

export type StickyColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple';

export interface Sticky {
  id: string;
  content: string;
  color: StickyColor;
  createdAt: number;
  updatedAt: number;
}

export interface UseStickiesResult {
  stickies: Sticky[];
  hydrated: boolean;
  addSticky: (initial?: Partial<Sticky>) => Sticky;
  updateSticky: (id: string, patch: Partial<Sticky>) => void;
  removeSticky: (id: string) => void;
  reorder: (fromId: string, toIndex: number) => void;
}

const COLORS: StickyColor[] = ['yellow', 'pink', 'blue', 'green', 'purple'];

function isSSR(): boolean {
  return typeof window === 'undefined';
}

function generateId(): string {
  if (!isSSR() && typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `sticky_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isStickyColor(value: unknown): value is StickyColor {
  return typeof value === 'string' && (COLORS as string[]).includes(value);
}

function isSticky(value: unknown): value is Sticky {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.content === 'string' &&
    isStickyColor(v.color) &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number'
  );
}

function readFromStorage(): Sticky[] {
  if (isSSR()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSticky);
  } catch {
    return [];
  }
}

function writeToStorage(items: Sticky[]): void {
  if (isSSR()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / serialization errors
  }
}

export function useStickies(): UseStickiesResult {
  const [stickies, setStickies] = useState<Sticky[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const skipNextWriteRef = useRef(true);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    setStickies(readFromStorage());
    setHydrated(true);
  }, []);

  // Persist to localStorage on changes (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    if (skipNextWriteRef.current) {
      skipNextWriteRef.current = false;
      return;
    }
    writeToStorage(stickies);
  }, [stickies, hydrated]);

  // Cross-tab sync via storage event
  useEffect(() => {
    if (isSSR()) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setStickies(readFromStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addSticky = useCallback((initial?: Partial<Sticky>): Sticky => {
    const now = Date.now();
    const sticky: Sticky = {
      id: initial?.id ?? generateId(),
      content: initial?.content ?? '',
      color: isStickyColor(initial?.color) ? (initial!.color as StickyColor) : 'yellow',
      createdAt: typeof initial?.createdAt === 'number' ? initial.createdAt : now,
      updatedAt: typeof initial?.updatedAt === 'number' ? initial.updatedAt : now,
    };
    setStickies((prev) => [sticky, ...prev]);
    return sticky;
  }, []);

  const updateSticky = useCallback((id: string, patch: Partial<Sticky>): void => {
    setStickies((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              ...patch,
              id: s.id,
              createdAt: s.createdAt,
              updatedAt: Date.now(),
            }
          : s
      )
    );
  }, []);

  const removeSticky = useCallback((id: string): void => {
    setStickies((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const reorder = useCallback((fromId: string, toIndex: number): void => {
    setStickies((prev) => {
      const fromIndex = prev.findIndex((s) => s.id === fromId);
      if (fromIndex === -1) return prev;
      const clamped = Math.max(0, Math.min(toIndex, prev.length - 1));
      if (clamped === fromIndex) return prev;
      const next = prev.slice();
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return prev;
      next.splice(clamped, 0, moved);
      return next;
    });
  }, []);

  return {
    stickies,
    hydrated,
    addSticky,
    updateSticky,
    removeSticky,
    reorder,
  };
}

export const STICKY_COLORS = COLORS;
