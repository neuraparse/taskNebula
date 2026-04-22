'use client';

import * as React from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  TEMPLATE_CATEGORIES,
  WORK_ITEM_TEMPLATES,
  instantiateTemplate,
  type TemplateCategory,
  type WorkItemTemplate,
} from '@/lib/templates/registry';
import { TemplateCard } from './template-card';

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

export function TemplatesGrid({
  templates = WORK_ITEM_TEMPLATES,
  onUse,
  className,
}: TemplatesGridProps) {
  const { toast } = useToast();
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<FilterValue>('all');

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
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
  }, [templates, query, category]);

  const handleUse = React.useCallback(
    (template: WorkItemTemplate) => {
      if (onUse) {
        onUse(template);
        return;
      }
      // Stub instantiation — real wiring should POST /api/issues.
      const draft = instantiateTemplate(template);
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.debug('[templates] instantiated draft (stub)', draft);
      }
      toast({
        title: 'Template instantiated (stub)',
        description: `"${template.name}" is ready — wire to /api/issues create.`,
      });
    },
    [onUse, toast]
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
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No templates match</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different search term or clear the category filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={handleUse}
            />
          ))}
        </div>
      )}
    </div>
  );
}
