'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  TEMPLATE_CATEGORIES,
  WORK_ITEM_TEMPLATES,
  instantiateTemplate,
  type TemplateCategory,
  type WorkItemTemplate,
} from '@/lib/templates/registry';
import { TemplateCard } from './template-card';
import { NewTemplateDialog } from './new-template-dialog';
import {
  useDeleteTemplate,
  useInstantiateTemplate,
  useTemplatesList,
  type ApiTemplate,
} from './use-templates';

type FilterValue = 'all' | TemplateCategory;

const FILTERS: ReadonlyArray<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'All' },
  ...TEMPLATE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];

export interface TemplatesGridProps {
  templates?: WorkItemTemplate[];
  onUse?: (template: WorkItemTemplate) => void;
  className?: string;
}

/**
 * Map an API template to the card-shaped `WorkItemTemplate` so the existing
 * card renderer stays untouched. We stash the real id under a prefix so the
 * grid can differentiate DB rows from the static registry at click-time.
 */
const DB_PREFIX = 'db:';

function apiTemplateToCard(row: ApiTemplate): WorkItemTemplate {
  const category = resolveCategory(row);
  const type = resolveType(row);
  const labels = Array.isArray((row.payload as any)?.labels)
    ? ((row.payload as any).labels as string[])
    : [];
  return {
    id: `${DB_PREFIX}${row.id}`,
    name: row.name,
    description: row.description ?? `${capitalize(row.kind)} template`,
    category,
    type,
    icon: row.icon ?? defaultIconForKind(row.kind),
    body: typeof (row.payload as any)?.description === 'string'
      ? ((row.payload as any).description as string)
      : '',
    labels,
    estimatePoints: typeof (row.payload as any)?.estimate === 'number'
      ? ((row.payload as any).estimate as number)
      : undefined,
  };
}

function resolveCategory(row: ApiTemplate): TemplateCategory {
  const known = TEMPLATE_CATEGORIES.map((c) => c.value) as TemplateCategory[];
  const raw = String(row.category ?? '').toLowerCase();
  if ((known as string[]).includes(raw)) return raw as TemplateCategory;
  return 'general';
}

function resolveType(row: ApiTemplate): WorkItemTemplate['type'] {
  if (row.kind === 'issue') {
    const raw = String((row.payload as any)?.type ?? 'task').toLowerCase();
    if (['story', 'task', 'bug', 'epic'].includes(raw)) {
      return raw as WorkItemTemplate['type'];
    }
    return 'task';
  }
  // Projects and docs render as generic "task" cards; the kind is conveyed
  // through the icon + name so we don't mislead the badge UI.
  return 'task';
}

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return (value[0] ?? '').toUpperCase() + value.slice(1);
}

function defaultIconForKind(kind: ApiTemplate['kind']): string {
  if (kind === 'project') return '📁';
  if (kind === 'issue') return '🧩';
  if (kind === 'doc') return '📄';
  return '✨';
}

export function TemplatesGrid({
  templates: registryOverride,
  onUse,
  className,
}: TemplatesGridProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<FilterValue>('all');

  const listQuery = useTemplatesList();
  const instantiate = useInstantiateTemplate();
  const deleteMutation = useDeleteTemplate();

  const apiTemplates = listQuery.data?.templates ?? [];
  const canAdminister = listQuery.data?.canAdminister ?? false;

  const adminById = React.useMemo(() => {
    const admins = new Set(listQuery.data?.adminOrganizationIds ?? []);
    const byId = new Map<string, boolean>();
    for (const row of apiTemplates) {
      byId.set(
        row.id,
        canAdminister && (row.organizationId === null || admins.has(row.organizationId))
      );
    }
    return byId;
  }, [apiTemplates, canAdminister, listQuery.data?.adminOrganizationIds]);

  const dbCards = React.useMemo(
    () => apiTemplates.map(apiTemplateToCard),
    [apiTemplates]
  );

  const registryCards = registryOverride ?? WORK_ITEM_TEMPLATES;
  const allCards = React.useMemo(
    () => [...dbCards, ...registryCards],
    [dbCards, registryCards]
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allCards.filter((template) => {
      if (category !== 'all' && template.category !== category) return false;
      if (!needle) return true;
      const haystack = [
        template.name,
        template.description,
        template.category,
        template.type,
        ...template.labels,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [allCards, query, category]);

  const handleUse = React.useCallback(
    async (template: WorkItemTemplate) => {
      if (onUse) {
        onUse(template);
        return;
      }

      if (template.id.startsWith(DB_PREFIX)) {
        const realId = template.id.slice(DB_PREFIX.length);
        const apiRow = apiTemplates.find((r) => r.id === realId);
        try {
          const result = await instantiate.mutateAsync({ id: realId });
          if (result.kind === 'project' && result.resource) {
            const res = result.resource as { id: string; name?: string; key?: string };
            toast({
              title: 'Project created',
              description: res.name ?? 'Your new project is ready.',
            });
            router.push(`/projects/${res.id}`);
            return;
          }
          if (result.kind === 'issue' && result.resource) {
            const res = result.resource as { id: string; key?: string; title?: string };
            toast({
              title: 'Issue created',
              description: res.key ?? res.title ?? 'A new issue has been created.',
            });
            if (res.key) router.push(`/issues/${res.key}`);
            return;
          }
          if (result.kind === 'doc') {
            toast({
              title: 'Doc template ready',
              description:
                apiRow?.name ?? 'Open Docs to apply this template to a page.',
            });
            return;
          }
          toast({
            title: 'Template applied',
            description: 'The template was processed.',
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Could not apply template.';
          toast({
            title: 'Failed to use template',
            description: message,
            variant: 'destructive',
          });
        }
        return;
      }

      // Legacy static-registry template: keep the previous stub behaviour so
      // the catalogue remains browsable even before any DB rows exist.
      const draft = instantiateTemplate(template);
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.debug('[templates] instantiated draft (stub)', draft);
      }
      toast({
        title: 'Template ready',
        description: `"${template.name}" is a starter — create a DB template to enable one-click instantiation.`,
      });
    },
    [apiTemplates, instantiate, onUse, router, toast]
  );

  const handleDelete = React.useCallback(
    async (templateId: string) => {
      try {
        await deleteMutation.mutateAsync(templateId);
        toast({ title: 'Template deleted' });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not delete template.';
        toast({
          title: 'Failed to delete template',
          description: message,
          variant: 'destructive',
        });
      }
    },
    [deleteMutation, toast]
  );

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Filter by category"
            className="flex flex-wrap items-center gap-1.5"
          >
            {FILTERS.map((filter) => {
              const active = category === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(filter.value)}
                  className={cn(
                    'inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors duration-150 ease-snap',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    active
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground'
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          {canAdminister ? <NewTemplateDialog /> : null}
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card/50 py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          Loading templates…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No templates match</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different search term or clear the category filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => {
            const isDb = template.id.startsWith(DB_PREFIX);
            const realId = isDb ? template.id.slice(DB_PREFIX.length) : null;
            const canDelete = realId ? adminById.get(realId) === true : false;
            return (
              <div key={template.id} className="relative">
                <TemplateCard template={template} onUse={handleUse} />
                {canDelete && realId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-2 h-7 w-7 p-0 opacity-0 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete template ${template.name}`}
                    disabled={deleteMutation.isPending}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (
                        typeof window !== 'undefined' &&
                        !window.confirm(`Delete template "${template.name}"?`)
                      ) {
                        return;
                      }
                      handleDelete(realId);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
