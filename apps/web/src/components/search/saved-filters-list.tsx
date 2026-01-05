'use client';

import React, { useState } from 'react';
import { Star, Trash2, Globe, Lock, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrganization } from '@/lib/hooks/use-organization';

interface SavedFilter {
  id: string;
  name: string;
  description?: string | null;
  query: string;
  isPublic: boolean;
  isStarred: boolean;
  usageCount: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

interface SavedFiltersListProps {
  onSelectFilter: (filter: SavedFilter) => void;
}

export function SavedFiltersList({ onSelectFilter }: SavedFiltersListProps) {
  const { currentOrganizationId } = useOrganization();
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch filters
  const fetchFilters = async () => {
    if (!currentOrganizationId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/saved-filters?organizationId=${currentOrganizationId}&includePublic=true`
      );
      const data = await response.json();
      setFilters(data.filters || []);
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle star
  const toggleStar = async (filterId: string, currentStarred: boolean) => {
    try {
      await fetch(`/api/saved-filters/${filterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: !currentStarred }),
      });
      fetchFilters();
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  // Delete filter
  const deleteFilter = async (filterId: string) => {
    if (!confirm('Are you sure you want to delete this filter?')) return;

    try {
      await fetch(`/api/saved-filters/${filterId}`, {
        method: 'DELETE',
      });
      fetchFilters();
    } catch (error) {
      console.error('Failed to delete filter:', error);
    }
  };

  // Apply filter
  const applyFilter = async (filter: SavedFilter) => {
    try {
      // Increment usage count
      await fetch(`/api/saved-filters/${filter.id}/use`, {
        method: 'POST',
      });
      onSelectFilter(filter);
    } catch (error) {
      console.error('Failed to apply filter:', error);
    }
  };

  // Load filters on mount
  React.useEffect(() => {
    fetchFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganizationId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saved Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (filters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saved Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No saved filters yet. Create one from the advanced search.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {filters.map((filter) => (
              <div
                key={filter.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                onClick={() => applyFilter(filter)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{filter.name}</h4>
                    {filter.isPublic ? (
                      <Globe className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  {filter.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {filter.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {filter.query}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      Used {filter.usageCount} times
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(filter.id, filter.isStarred);
                    }}
                  >
                    <Star
                      className={`h-4 w-4 ${
                        filter.isStarred ? 'fill-yellow-400 text-yellow-400' : ''
                      }`}
                    />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFilter(filter.id);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

