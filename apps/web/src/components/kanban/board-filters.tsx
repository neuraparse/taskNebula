'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface BoardFilters {
  search: string;
  priority: string[];
  assignee: string[];
  labels: string[];
}

interface BoardFiltersProps {
  filters: BoardFilters;
  onFiltersChange: (filters: BoardFilters) => void;
  issueCount: number;
  filteredCount: number;
}

export function BoardFiltersBar({ filters, onFiltersChange, issueCount, filteredCount }: BoardFiltersProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const activeFilterCount =
    filters.priority.length +
    filters.assignee.length +
    filters.labels.length;

  const hasAnyFilter = filters.search || activeFilterCount > 0;

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      priority: [],
      assignee: [],
      labels: [],
    });
    setSearchOpen(false);
  };

  const removeFilter = (type: keyof BoardFilters, value: string) => {
    if (type === 'search') {
      onFiltersChange({ ...filters, search: '' });
    } else {
      onFiltersChange({
        ...filters,
        [type]: filters[type].filter((v) => v !== value),
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Search toggle */}
      {searchOpen ? (
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-8 h-8 text-xs"
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
            className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={() => {
              onFiltersChange({ ...filters, search: '' });
              setSearchOpen(false);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Filter Popover */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground',
              activeFilterCount > 0 && 'text-foreground'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px] min-w-[16px] justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</h4>
            <div className="flex flex-wrap gap-1.5">
              {['critical', 'high', 'medium', 'low'].map((priority) => (
                <Button
                  key={priority}
                  variant={filters.priority.includes(priority) ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs capitalize"
                  onClick={() => {
                    const newPriority = filters.priority.includes(priority)
                      ? filters.priority.filter((p) => p !== priority)
                      : [...filters.priority, priority];
                    onFiltersChange({ ...filters, priority: newPriority });
                  }}
                >
                  {priority}
                </Button>
              ))}
            </div>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => {
                  clearFilters();
                  setFilterOpen(false);
                }}
              >
                Clear all filters
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Issue count */}
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {filteredCount !== issueCount ? (
          <>{filteredCount}/{issueCount}</>
        ) : (
          <>{issueCount} issues</>
        )}
      </span>

      {/* Active filter badges */}
      {hasAnyFilter && (
        <>
          <div className="h-4 w-px bg-border" />
          {filters.search && (
            <Badge variant="secondary" className="h-5 gap-1 pl-1.5 pr-0.5 text-[10px]">
              &quot;{filters.search}&quot;
              <button
                className="ml-0.5 hover:bg-muted rounded p-0.5"
                onClick={() => removeFilter('search', '')}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
          {filters.priority.map((priority) => (
            <Badge key={priority} variant="secondary" className="h-5 gap-1 pl-1.5 pr-0.5 text-[10px] capitalize">
              {priority}
              <button
                className="ml-0.5 hover:bg-muted rounded p-0.5"
                onClick={() => removeFilter('priority', priority)}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          <button
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={clearFilters}
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}
