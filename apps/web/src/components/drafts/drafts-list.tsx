'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  ArrowUpRight,
  CheckSquare,
  FileText,
  Inbox,
  MessageSquare,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ComponentType } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDrafts, type Draft } from '@/lib/drafts/use-drafts';
import { cn } from '@/lib/utils';

type DraftFilter = 'all' | Draft['type'];
type SortKey = 'updated' | 'created';

const TYPE_META: Record<
  Draft['type'],
  { label: string; icon: ComponentType<{ className?: string }> }
> = {
  work_item: { label: 'Work item', icon: CheckSquare },
  page: { label: 'Page', icon: FileText },
  comment: { label: 'Comment', icon: MessageSquare },
};

function truncate(text: string | undefined, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function DraftsList() {
  const {
    drafts,
    updateDraft,
    removeDraft,
    promoteDraft,
    isLoading,
    isError,
    error,
  } = useDrafts();
  const [filter, setFilter] = useState<DraftFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const counts = useMemo(() => {
    const base = { all: drafts.length, work_item: 0, page: 0, comment: 0 };
    for (const d of drafts) base[d.type] += 1;
    return base;
  }, [drafts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = drafts.filter((d) => {
      if (filter !== 'all' && d.type !== filter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.body ?? '').toLowerCase().includes(q)
      );
    });
    const sorted = [...filtered].sort((a, b) => {
      const key = sort === 'updated' ? 'updatedAt' : 'createdAt';
      return b[key] - a[key];
    });
    return sorted;
  }, [drafts, filter, query, sort]);

  const beginEdit = (draft: Draft) => {
    setEditingId(draft.id);
    setEditTitle(draft.title);
  };

  const commitEdit = () => {
    if (editingId) {
      void updateDraft(editingId, {
        title: editTitle.trim() || 'Untitled draft',
      });
    }
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as DraftFilter)}
          className="w-full sm:w-auto"
        >
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              All
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {counts.all}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="work_item" className="gap-2">
              Work items
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {counts.work_item}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="page" className="gap-2">
              Pages
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {counts.page}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="comment" className="gap-2">
              Comments
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {counts.comment}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search drafts"
              className="pl-8 w-full sm:w-64"
              aria-label="Search drafts"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[140px]" aria-label="Sort drafts">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="created">Created</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={error?.message ?? 'Could not load drafts.'} />
      ) : visible.length === 0 ? (
        <EmptyState hasAny={drafts.length > 0} />
      ) : (
        <ul className="divide-y rounded-md border bg-card">
          {visible.map((draft) => {
            const meta = TYPE_META[draft.type];
            const Icon = meta.icon;
            const isEditing = editingId === draft.id;
            return (
              <li
                key={draft.id}
                className="group flex items-start gap-3 p-3 transition-colors hover:bg-accent/40"
              >
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <Input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitEdit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingId(null);
                        }
                      }}
                      className="h-8"
                      aria-label="Edit draft title"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {draft.title || 'Untitled draft'}
                      </p>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {meta.label}
                      </Badge>
                    </div>
                  )}
                  {draft.body ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {truncate(draft.body, 80)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Updated {formatDistanceToNow(draft.updatedAt, { addSuffix: true })}
                  </p>
                </div>

                <div
                  className={cn(
                    'flex shrink-0 items-center gap-1 opacity-0 transition-opacity',
                    'group-hover:opacity-100 focus-within:opacity-100',
                  )}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => beginEdit(draft)}
                    aria-label="Edit draft"
                    title="Edit"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => {
                      void promoteDraft(draft.id);
                    }}
                    aria-label="Promote draft"
                    title="Promote"
                  >
                    <ArrowUpRight className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      void removeDraft(draft.id);
                    }}
                    aria-label="Delete draft"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <ul
      className="divide-y rounded-md border bg-card"
      aria-busy="true"
      aria-label="Loading drafts"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 p-3">
          <div className="mt-0.5 size-8 shrink-0 animate-pulse rounded-md bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-7" />
      </div>
      <h2 className="mt-4 text-base font-semibold">Could not load drafts</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="size-7" />
      </div>
      <h2 className="mt-4 text-base font-semibold">No drafts yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasAny
          ? 'Nothing matches your current filter or search. Try clearing them to see your other drafts.'
          : 'Stash unfinished work items, pages, and comments here. They sync across your devices until you promote them.'}
      </p>
      <div className="mt-5">
        <Button asChild>
          <Link href="/issues?draft=new">Create work item</Link>
        </Button>
      </div>
    </div>
  );
}
