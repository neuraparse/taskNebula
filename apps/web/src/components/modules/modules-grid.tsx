'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Layers, Plus, LayoutGrid, List, CalendarClock, Users, ListChecks } from 'lucide-react';
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

const VIEW_OPTIONS: { value: ViewMode; labelKey: string; icon: typeof LayoutGrid }[] = [
  { value: 'gallery', labelKey: 'view_gallery', icon: LayoutGrid },
  { value: 'list', labelKey: 'view_list', icon: List },
];

const FILTER_OPTIONS: { value: FilterChip; labelKey: string }[] = [
  { value: 'all', labelKey: 'filter_all' },
  { value: 'in_progress', labelKey: 'filter_in_progress' },
  { value: 'completed', labelKey: 'filter_completed' },
  { value: 'backlog', labelKey: 'filter_backlog' },
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
  const t = useTranslations('planning');
  const [view, setView] = useState<ViewMode>('gallery');
  const [filter, setFilter] = useState<FilterChip>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () => modules.filter((m) => matchesFilter(m.status, filter)),
    [modules, filter]
  );

  return (
    <div className="space-y-4">
      {/* Top bar: view switcher, filters, new module */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="border-border bg-card inline-flex rounded-md border p-0.5">
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
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(opt.labelKey)}
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
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          {t('new_module')}
        </Button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
          {t('loading_modules')}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} hasAny={modules.length > 0} />
      ) : view === 'gallery' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
  const t = useTranslations('planning');
  return (
    <div className="border-border mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
      <Layers className="text-muted-foreground h-8 w-8" />
      <p className="text-muted-foreground text-sm">
        {hasAny ? t('no_modules_filter') : t('no_modules_empty')}
      </p>
      {!hasAny && (
        <Button size="sm" variant="outline" onClick={onCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t('create_module')}
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
  const t = useTranslations('planning');
  return (
    <div className="divide-border border-border bg-card divide-y rounded-xl border">
      {modules.map((m) => {
        const palette = getModuleStatusPalette(m.status);
        const total = m.totalIssues ?? 0;
        const completed = m.completedIssues ?? 0;
        const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
        const targetLabel = formatTargetDate(m.targetDate);

        return (
          <button
            key={m.id}
            type="button"
            onClick={() =>
              // eslint-disable-next-line no-console
              console.info(`[modules] navigate → /projects/${projectId}/modules/${m.id}`)
            }
            className={cn(
              'flex w-full items-center gap-3 px-4 py-2.5 text-left',
              'hover:bg-muted/40 transition-colors',
              'focus-visible:bg-muted/40 focus-visible:outline-none'
            )}
          >
            <span
              className={cn('inline-block h-2 w-2 shrink-0 rounded-full', palette.dot)}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{m.name}</span>
                <Badge variant="outline" className={cn('border text-[10px]', palette.badge)}>
                  {t(palette.labelKey)}
                </Badge>
              </div>
              {m.description && (
                <p className="text-muted-foreground truncate text-xs">{m.description}</p>
              )}
            </div>
            <div className="hidden w-32 items-center gap-2 md:flex">
              <div className="bg-primary/10 h-1.5 flex-1 overflow-hidden rounded-sm">
                <div className="bg-primary h-full rounded-sm" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-muted-foreground w-10 text-[11px] tabular-nums">
                <ListChecks className="-mt-0.5 mr-0.5 inline h-3 w-3" />
                {completed}/{total}
              </span>
            </div>
            <span className="text-muted-foreground hidden w-16 items-center gap-1 text-[11px] sm:inline-flex">
              <Users className="h-3 w-3" />
              {m.memberIds.length}
            </span>
            <span className="text-muted-foreground hidden w-20 items-center justify-end gap-1 text-[11px] sm:inline-flex">
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
