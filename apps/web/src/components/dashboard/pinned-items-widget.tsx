'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  FolderKanban,
  Inbox,
  MessageSquare,
  Pin,
  PinOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type PinnedKind = 'issue' | 'doc' | 'project' | 'chat' | 'custom';

export interface PinnedItem {
  id: string;
  userId: string;
  kind: PinnedKind | string;
  entityId: string | null;
  title: string;
  href: string;
  pinnedAt: string;
}

async function fetchPinnedItems(): Promise<PinnedItem[]> {
  const res = await fetch('/api/pinned-items');
  if (!res.ok) throw new Error('Failed to load pinned items');
  const json = (await res.json()) as { items: PinnedItem[] };
  return json.items ?? [];
}

async function deletePinnedItem(id: string): Promise<void> {
  const res = await fetch(`/api/pinned-items/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to unpin item');
}

const KIND_ICON: Record<string, LucideIcon> = {
  project: FolderKanban,
  doc: FileText,
  issue: FileText,
  chat: MessageSquare,
  custom: Inbox,
  // Legacy value retained so pins created before the schema change still render.
  view: Inbox,
};

export function PinnedItemsWidget() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<PinnedItem[]>({
    queryKey: ['pinned-items'],
    queryFn: fetchPinnedItems,
  });

  const unpinMutation = useMutation({
    mutationFn: deletePinnedItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-items'] });
    },
  });

  const items = data ?? [];
  const visible = items.slice(0, 7);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-foreground">
          Pinned items
        </span>
        {items.length > visible.length ? (
          <span className="text-xs text-muted-foreground">
            {items.length} pinned
          </span>
        ) : null}
      </div>

      {isLoading ? (
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
            const Icon = KIND_ICON[item.kind] ?? FileText;
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
                  onClick={() => unpinMutation.mutate(item.id)}
                  disabled={unpinMutation.isPending}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-opacity duration-150 disabled:opacity-50"
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
