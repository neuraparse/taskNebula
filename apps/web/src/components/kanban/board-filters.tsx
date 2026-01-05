'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, Users, Tag, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';

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
  const [open, setOpen] = useState(false);

  const activeFilterCount = 
    filters.priority.length + 
    filters.assignee.length + 
    filters.labels.length;

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      priority: [],
      assignee: [],
      labels: [],
    });
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
    <div className="space-y-3">
      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9 h-9 bg-background/60 backdrop-blur border-muted-foreground/20"
          />
          {filters.search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => onFiltersChange({ ...filters, search: '' })}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Filter Popover */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-3">Filter Issues</h4>
              </div>

              {/* Priority Filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Priority
                </Label>
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
              </div>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    clearFilters();
                    setOpen(false);
                  }}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Results Count */}
        <div className="text-xs text-muted-foreground ml-auto">
          {filteredCount !== issueCount ? (
            <span>
              Showing <span className="font-semibold text-foreground">{filteredCount}</span> of{' '}
              <span className="font-semibold">{issueCount}</span>
            </span>
          ) : (
            <span>
              <span className="font-semibold text-foreground">{issueCount}</span> issues
            </span>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {(filters.search || activeFilterCount > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Active filters:</span>

          {filters.search && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1">
              <Search className="h-3 w-3" />
              {filters.search}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 hover:bg-transparent"
                onClick={() => removeFilter('search', '')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {filters.priority.map((priority) => (
            <Badge key={priority} variant="secondary" className="gap-1 pl-2 pr-1 capitalize">
              <AlertCircle className="h-3 w-3" />
              {priority}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 hover:bg-transparent"
                onClick={() => removeFilter('priority', priority)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={clearFilters}
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}


