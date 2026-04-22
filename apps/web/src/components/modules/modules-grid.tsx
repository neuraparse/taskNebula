'use client';

import { useMemo, useState } from 'react';
import {
  Layers,
  Plus,
  LayoutGrid,
  List,
  CalendarClock,
  Users,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useModules, type ModuleStatus } from '@/lib/modules/use-modules';
import { ModuleCard, getModuleStatusPalette } from './module-card';
import { ModuleCreateDialog } from './module-create-dialog';

type ViewMode = 'gallery' | 'list';
type FilterChip = 'all' | 'in_progress' | 'completed' | 'backlog';

interface ModulesGridProps {
  projectId: string;
}

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'gallery', label: 'Gallery', icon: LayoutGrid },
  { value: 'list', label: 'List', icon: List },
];

const FILTER_OPTIONS: { value: FilterChip; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'backlog', label: 'Backlog' },
];

function matchesFilter(status: ModuleStatus, filter: FilterChip): boolean {
  if (filter === 'all') return true;
  return status === filter;
}

function formatTargetDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ModulesGrid({ projectId }: ModulesGridProps) {
  const { modules, isLoading, createModule } = useModules(projectId);
  const [view, setView] = useState<ViewMode>('gallery');
  const [filter, setFilter] = useState<FilterChip>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () => modules.filter((m) => matchesFilter(m.status, filter)),
    [modules, filter],
  );

  return (
    <div className="space-y-4">
      {/* Top bar: view switcher, filters, new module */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            {VIEW_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = view === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setView(opt.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_OPTIONS.map((opt) => {
              const active = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                    active
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          New module
        </Button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading modules...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} hasAny={modules.length > 0} />
      ) : view === 'gallery' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <ModuleCard key={m.id} module={m} />
          ))}
        </div>
      ) : (
        <ModulesList projectId={projectId} modules={filtered} />
      )}

      <ModuleCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        createModule={createModule}
      />
    </div>
  );
}

function EmptyState({ onCreate, hasAny }: { onCreate: () => void; hasAny: boolean }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
      <Layers className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {hasAny
          ? 'No modules match this filter.'
          : 'No modules yet. Create one to group related work.'}
      </p>
      {!hasAny && (
        <Button size="sm" variant="outline" onClick={onCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create module
        </Button>
      )}
    </div>
  );
}

function ModulesList({
  projectId,
  modules,
}: {
  projectId: string;
  modules: ReturnType<typeof useModules>['modules'];
}) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {modules.map((m) => {
        const palette = getModuleStatusPalette(m.status);
        const total = m.totalIssues ?? 0;
        const completed = m.completedIssues ?? 0;
        const progress =
          total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
        const targetLabel = formatTargetDate(m.targetDate);

        return (
          <button
            key={m.id}
            type="button"
            onClick={() =>
              // eslint-disable-next-line no-console
              console.info(
                `[modules] navigate → /projects/${projectId}/modules/${m.id}`,
              )
            }
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2.5 text-left',
              'hover:bg-muted/40 transition-colors',
              'focus-visible:outline-none focus-visible:bg-muted/40',
            )}
          >
            <span
              className={cn('inline-block h-2 w-2 rounded-full shrink-0', palette.dot)}
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{m.name}</span>
                <Badge
                  variant="outline"
                  className={cn('border text-[10px]', palette.badge)}
                >
                  {palette.label}
                </Badge>
              </div>
              {m.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {m.description}
                </p>
              )}
            </div>
            <div className="hidden md:flex items-center gap-2 w-32">
              <div className="flex-1 h-1.5 overflow-hidden rounded-sm bg-primary/10">
                <div
                  className="h-full rounded-sm bg-primary"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums w-10">
                <ListChecks className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                {completed}/{total}
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground w-16">
              <Users className="h-3 w-3" />
              {m.memberIds.length}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground w-20 justify-end">
              {targetLabel ? (
                <>
                  <CalendarClock className="h-3 w-3" />
                  {targetLabel}
                </>
              ) : (
                <span className="text-muted-foreground/50">—</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
