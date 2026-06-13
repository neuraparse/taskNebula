'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export interface BoardFilters {
  search: string;
  priority: string[];
  assignee: string[];
  labels: string[];
}

export const DEFAULT_BOARD_FILTERS: BoardFilters = {
  search: '',
  priority: [],
  assignee: [],
  labels: [],
};

interface BoardFiltersProps {
  filters: BoardFilters;
  onFiltersChange: (filters: BoardFilters) => void;
  issueCount: number;
  filteredCount: number;
}

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

export function BoardFiltersBar({
  filters,
  onFiltersChange,
  issueCount,
  filteredCount,
}: BoardFiltersProps) {
  const t = useTranslations('kanban');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const activeFilterCount =
    filters.priority.length + filters.assignee.length + filters.labels.length;

  const hasAnyFilter = filters.search || activeFilterCount > 0;

  const clearFilters = () => {
    onFiltersChange(DEFAULT_BOARD_FILTERS);
    setSearchOpen(false);
  };

  const removeFilter = (type: keyof BoardFilters, value: string) => {
    if (type === 'search') {
      onFiltersChange({ ...filters, search: '' });
    } else {
      onFiltersChange({
        ...filters,
        [type]: (filters[type] as string[]).filter((v) => v !== value),
      });
    }
  };

  const togglePriority = (priority: string) => {
    const next = filters.priority.includes(priority)
      ? filters.priority.filter((p) => p !== priority)
      : [...filters.priority, priority];
    onFiltersChange({ ...filters, priority: next });
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      {/* Search */}
      {searchOpen ? (
        <div className="relative w-52">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder={t('filters.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="border-border/60 bg-background h-8 rounded-md pl-8 text-xs shadow-none"
            autoFocus
            onBlur={() => {
              if (!filters.search) setSearchOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onFiltersChange({ ...filters, search: '' });
                setSearchOpen(false);
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground absolute right-0.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md"
            onClick={() => {
              onFiltersChange({ ...filters, search: '' });
              setSearchOpen(false);
            }}
            aria-label={t('filters.clearSearch')}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-md"
          onClick={() => setSearchOpen(true)}
          aria-label={t('filters.searchAria')}
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Filter popover trigger */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'text-muted-foreground h-8 gap-1.5 rounded-md px-2.5 text-xs transition-colors duration-200',
              activeFilterCount > 0
                ? 'chip-accent'
                : 'hover:border-primary/30 hover:text-foreground'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            {t('filters.filter')}
            {activeFilterCount > 0 && (
              <span className="bg-primary/20 text-primary flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="border-border w-64 rounded-lg p-3 shadow-sm" align="start">
          <div className="space-y-3">
            <p className="kicker">{t('filters.priority')}</p>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map((priority) => (
                <button
                  key={priority}
                  onClick={() => togglePriority(priority)}
                  className={cn(
                    'transition-colors duration-200',
                    filters.priority.includes(priority)
                      ? 'chip-accent'
                      : 'chip hover:border-primary/30'
                  )}
                >
                  {t(`priority.${priority}`)}
                </button>
              ))}
            </div>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-7 w-full rounded-md text-xs"
                onClick={() => {
                  clearFilters();
                  setFilterOpen(false);
                }}
              >
                {t('filters.clearAll')}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Issue count */}
      <span className="text-muted-foreground text-[11px] tabular-nums">
        {filteredCount !== issueCount
          ? `${filteredCount}/${issueCount}`
          : t('filters.issueCount', { count: issueCount })}
      </span>

      {/* Active filter pills */}
      {hasAnyFilter && (
        <>
          <div className="bg-border h-3.5 w-px" />
          {filters.search && (
            <span className="chip gap-1">
              {`"${filters.search}"`}
              <button
                className="hover:bg-muted ml-0.5 rounded-full p-0.5"
                onClick={() => removeFilter('search', '')}
                aria-label={t('filters.removeSearch')}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {filters.priority.map((priority) => (
            <span key={priority} className="chip-accent gap-1">
              {t(`priority.${priority}`)}
              <button
                className="hover:bg-primary/20 ml-0.5 rounded-full p-0.5"
                onClick={() => removeFilter('priority', priority)}
                aria-label={t('filters.removePriority', { priority: t(`priority.${priority}`) })}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <button
            className="text-muted-foreground hover:text-foreground text-[11px] transition-colors duration-200"
            onClick={clearFilters}
          >
            {t('filters.clear')}
          </button>
        </>
      )}
    </div>
  );
}
