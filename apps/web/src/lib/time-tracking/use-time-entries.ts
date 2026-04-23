'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface TimeEntry {
  id: string;
  issueId: string;
  userId: string;
  userName: string;
  hours: number;
  minutes: number;
  description?: string;
  loggedAt: number; // ms epoch
}

export interface UseTimeEntriesResult {
  entries: TimeEntry[];
  totalMinutes: number;
  formattedTotal: string;
  addEntry: (input: {
    hours: number;
    minutes: number;
    description?: string;
    userName: string;
    userId: string;
  }) => void;
  updateEntry: (id: string, patch: Partial<TimeEntry>) => void;
  removeEntry: (id: string) => void;
  isLoading: boolean;
}

const STORAGE_KEY_PREFIX = 'tn:time-entries:';

function storageKey(issueId: string): string {
  return `${STORAGE_KEY_PREFIX}${issueId}`;
}

function isSSR(): boolean {
  return typeof window === 'undefined';
}

function generateId(): string {
  if (!isSSR() && typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `te_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isTimeEntry(value: unknown): value is TimeEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.issueId === 'string' &&
    typeof v.userId === 'string' &&
    typeof v.userName === 'string' &&
    typeof v.hours === 'number' &&
    typeof v.minutes === 'number' &&
    typeof v.loggedAt === 'number' &&
    (v.description === undefined || typeof v.description === 'string')
  );
}

function readFromStorage(issueId: string): TimeEntry[] {
  if (isSSR()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(issueId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTimeEntry);
  } catch {
    return [];
  }
}

function writeToStorage(issueId: string, entries: TimeEntry[]): void {
  if (isSSR()) return;
  try {
    window.localStorage.setItem(storageKey(issueId), JSON.stringify(entries));
  } catch {
    // ignore quota / serialization errors
  }
}

function clampNonNegativeInt(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  const n = Math.trunc(value);
  if (n < 0) return 0;
  if (n > max) return max;
  return n;
}

export function formatDuration(totalMinutes: number): string {
  const safe = Number.isFinite(totalMinutes) ? Math.max(0, Math.trunc(totalMinutes)) : 0;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function useTimeEntries(issueId: string): UseTimeEntriesResult {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const skipNextWriteRef = useRef(true);

  // Hydrate from localStorage on mount / when issueId changes
  useEffect(() => {
    skipNextWriteRef.current = true;
    setHydrated(false);
    setEntries(readFromStorage(issueId));
    setHydrated(true);
  }, [issueId]);

  // Persist changes
  useEffect(() => {
    if (!hydrated) return;
    if (skipNextWriteRef.current) {
      skipNextWriteRef.current = false;
      return;
    }
    writeToStorage(issueId, entries);
  }, [entries, hydrated, issueId]);

  // Cross-tab sync
  useEffect(() => {
    if (isSSR()) return;
    const key = storageKey(issueId);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      skipNextWriteRef.current = true;
      setEntries(readFromStorage(issueId));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [issueId]);

  const addEntry = useCallback<UseTimeEntriesResult['addEntry']>(
    (input) => {
      const hours = clampNonNegativeInt(input.hours, 99);
      const minutes = clampNonNegativeInt(input.minutes, 59);
      if (hours === 0 && minutes === 0) return;
      const entry: TimeEntry = {
        id: generateId(),
        issueId,
        userId: input.userId,
        userName: input.userName,
        hours,
        minutes,
        description: input.description?.trim() ? input.description.trim() : undefined,
        loggedAt: Date.now(),
      };
      setEntries((prev) => [entry, ...prev]);
    },
    [issueId],
  );

  const updateEntry = useCallback<UseTimeEntriesResult['updateEntry']>((id, patch) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) return entry;
        const next: TimeEntry = { ...entry, ...patch, id: entry.id, issueId: entry.issueId };
        if (typeof patch.hours === 'number') {
          next.hours = clampNonNegativeInt(patch.hours, 99);
        }
        if (typeof patch.minutes === 'number') {
          next.minutes = clampNonNegativeInt(patch.minutes, 59);
        }
        if (patch.description !== undefined) {
          const trimmed = patch.description?.trim();
          next.description = trimmed ? trimmed : undefined;
        }
        return next;
      }),
    );
  }, []);

  const removeEntry = useCallback<UseTimeEntriesResult['removeEntry']>((id) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const totalMinutes = useMemo(
    () => entries.reduce((acc, entry) => acc + entry.hours * 60 + entry.minutes, 0),
    [entries],
  );

  const formattedTotal = useMemo(() => formatDuration(totalMinutes), [totalMinutes]);

  return {
    entries,
    totalMinutes,
    formattedTotal,
    addEntry,
    updateEntry,
    removeEntry,
    isLoading: !hydrated,
  };
}
