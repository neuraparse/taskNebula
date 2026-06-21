'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, FolderKanban, Inbox, MessageSquare, Pin, PinOff } from 'lucide-react';
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
  const t = useTranslations('dashboardExtra');
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
    <div className="surface-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-foreground text-sm font-semibold tracking-tight">
          {t('pinned.heading')}
        </span>
        {items.length > visible.length ? (
          <span className="text-muted-foreground text-xs">
            {t('pinned.count', { count: items.length })}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex min-h-[40px] items-center gap-3 rounded-md px-2 py-2">
              <span className="bg-muted h-4 w-4 animate-pulse rounded" />
              <span className="bg-muted h-3 flex-1 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Pin className="text-muted-foreground mb-2 h-7 w-7" />
          <p className="text-muted-foreground text-sm">{t('empty_no_items')}</p>
          <p className="text-muted-foreground mt-1 text-xs">{t('pinned.empty_hint')}</p>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {visible.map((item) => {
            const Icon = KIND_ICON[item.kind] ?? FileText;
            return (
              <li
                key={item.id}
                className="row-interactive ease-snap group flex min-h-[40px] items-center gap-3 rounded-md px-2 py-2 transition-all duration-150"
              >
                <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                <Link
                  href={item.href}
                  className="text-foreground flex-1 truncate text-sm hover:underline"
                >
                  {item.title}
                </Link>
                <button
                  type="button"
                  aria-label={t('pinned.unpin_aria', { title: item.title })}
                  onClick={() => unpinMutation.mutate(item.id)}
                  disabled={unpinMutation.isPending}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px] opacity-0 transition-opacity duration-150 focus-visible:opacity-100 disabled:opacity-50 group-hover:opacity-100"
                >
                  <PinOff className="h-3.5 w-3.5" />
                  {t('pinned.unpin')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
