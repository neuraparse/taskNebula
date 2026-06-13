'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Star, Trash2, Globe, Lock, Play, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const t = useTranslations('searchCommand');
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
    if (!confirm(t('confirmDeleteFilter'))) return;

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
      <div className="text-muted-foreground py-6 text-center text-sm">{t('loadingFilters')}</div>
    );
  }

  if (filters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <Bookmark className="text-muted-foreground/40 h-7 w-7" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">{t('noSavedFilters')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="kicker px-1">{t('savedFilters')}</span>
      <ScrollArea className="max-h-[360px]">
        <ul className="stagger space-y-px">
          {filters.map((filter) => (
            <li
              key={filter.id}
              className="row-interactive animate-fade-up ease-snap group rounded-md transition-all duration-150"
            >
              {/* Visibility icon */}
              <div className="text-muted-foreground shrink-0">
                {filter.isPublic ? (
                  <Globe className="h-3.5 w-3.5" aria-label={t('publicFilter')} />
                ) : (
                  <Lock className="h-3.5 w-3.5" aria-label={t('privateFilter')} />
                )}
              </div>

              {/* Name + meta */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium">{filter.name}</span>
                  {filter.isStarred && (
                    <Star
                      className="fill-accent-amber text-accent-amber h-3 w-3 shrink-0"
                      aria-label={t('starred')}
                    />
                  )}
                </div>
                {filter.description && (
                  <p className="text-muted-foreground truncate text-xs">{filter.description}</p>
                )}
                <p className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">
                  {filter.query}
                </p>
              </div>

              {/* Actions (visible on hover) */}
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStar(filter.id, filter.isStarred);
                  }}
                  aria-label={filter.isStarred ? t('unstarFilter') : t('starFilter')}
                >
                  <Star
                    className={`h-3.5 w-3.5 ${
                      filter.isStarred
                        ? 'fill-accent-amber text-accent-amber'
                        : 'text-muted-foreground'
                    }`}
                  />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    applyFilter(filter);
                  }}
                  aria-label={t('runFilter')}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="text-muted-foreground h-7 w-7">
                      <Trash2 className="h-3.5 w-3.5" />
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
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('deleteFilter')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
