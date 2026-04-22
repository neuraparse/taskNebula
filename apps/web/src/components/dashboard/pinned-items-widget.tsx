'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  FileText,
  FolderKanban,
  Inbox,
  Pin,
  PinOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const STORAGE_KEY = 'tn:pinned-items:v1';

export type PinnedType = 'project' | 'doc' | 'view' | 'issue';

export interface PinnedItem {
  id: string;
  type: PinnedType;
  title: string;
  href: string;
  pinnedAt: string;
}

function readStorage(): PinnedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is PinnedItem =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as PinnedItem).id === 'string' &&
        typeof (x as PinnedItem).title === 'string' &&
        typeof (x as PinnedItem).href === 'string'
    );
  } catch {
    return [];
  }
}

function writeStorage(items: PinnedItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / access errors
  }
}

function usePinnedItems() {
  const [items, setItems] = useState<PinnedItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readStorage());
    setHydrated(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const unpin = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      writeStorage(next);
      return next;
    });
  }, []);

  return { items, hydrated, unpin };
}

const TYPE_ICON: Record<PinnedType, LucideIcon> = {
  project: FolderKanban,
  doc: FileText,
  view: Inbox,
  issue: FileText,
};

export function PinnedItemsWidget() {
  const { items, hydrated, unpin } = usePinnedItems();
  const visible = items.slice(0, 7);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-foreground">
          Pinned items
        </span>
        <Link
          href="/pinned"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-all duration-150 ease-snap"
        >
          View all
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {!hydrated ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md px-2 py-2 min-h-[40px]"
            >
              <span className="h-4 w-4 rounded bg-muted animate-pulse" />
              <span className="h-3 flex-1 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Pin className="h-7 w-7 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No items</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pin views, projects, or work items for quick access.
          </p>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {visible.map((item) => {
            const Icon = TYPE_ICON[item.type] ?? FileText;
            return (
              <li
                key={item.id}
                className="group row-interactive flex items-center gap-3 rounded-md px-2 py-2 min-h-[40px] transition-all duration-150 ease-snap"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <Link
                  href={item.href}
                  className="text-sm truncate flex-1 text-foreground hover:underline"
                >
                  {item.title}
                </Link>
                <button
                  type="button"
                  aria-label={`Unpin ${item.title}`}
                  onClick={() => unpin(item.id)}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-opacity duration-150"
                >
                  <PinOff className="h-3.5 w-3.5" />
                  Unpin
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
