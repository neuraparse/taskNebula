'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Eye, EyeOff } from 'lucide-react';
import { useUser } from '@/lib/hooks/use-user';
import { cn } from '@/lib/utils';

interface WatchersListProps {
  issueId?: string;
  projectId?: string;
}

export function WatchersList({ issueId, projectId }: WatchersListProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Fetch watchers — mutation callbacks and API calls are preserved exactly.
  const { data, isLoading } = useQuery({
    queryKey: ['watchers', issueId, projectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (issueId) params.append('issueId', issueId);
      if (projectId) params.append('projectId', projectId);

      const response = await fetch(`/api/watchers?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch watchers');
      return response.json();
    },
    enabled: !!(issueId || projectId),
  });

  const watchers = data?.watchers || [];
  const isWatching = watchers.some((w: any) => w.userId === user?.id);

  // Add watcher mutation — API call untouched.
  const addWatcher = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/watchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, projectId }),
      });
      if (!response.ok) throw new Error('Failed to add watcher');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchers', issueId, projectId] });
    },
  });

  // Remove watcher mutation — API call untouched.
  const removeWatcher = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      if (issueId) params.append('issueId', issueId);
      if (projectId) params.append('projectId', projectId);

      const response = await fetch(`/api/watchers?${params.toString()}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove watcher');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchers', issueId, projectId] });
    },
  });

  const handleToggleWatch = () => {
    if (isWatching) {
      removeWatcher.mutate();
    } else {
      addWatcher.mutate();
    }
  };

  const isMutating = addWatcher.isPending || removeWatcher.isPending;
  const visibleAvatars = watchers.slice(0, 4);
  const overflowCount = watchers.length - visibleAvatars.length;

  return (
    <div className="flex items-center gap-2">
      {/* Avatar stack + count trigger */}
      {!isLoading && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`${watchers.length} ${watchers.length === 1 ? 'watcher' : 'watchers'} — click to view`}
            >
              {/* Overlapping avatar stack */}
              {watchers.length > 0 && (
                <span className="flex items-center" aria-hidden="true">
                  {visibleAvatars.map((watcher: any) => (
                    <Avatar
                      key={watcher.id}
                      className="-ml-2 first:ml-0 h-5 w-5 ring-2 ring-background"
                    >
                      <AvatarImage src={watcher.user.image} alt={watcher.user.name ?? ''} />
                      <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                        {watcher.user.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {overflowCount > 0 && (
                    <span className="-ml-2 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background bg-muted text-[9px] font-semibold text-muted-foreground">
                      +{overflowCount}
                    </span>
                  )}
                </span>
              )}
              <span>
                {isLoading
                  ? 'Loading…'
                  : watchers.length === 0
                    ? 'No watchers'
                    : `${watchers.length} watching`}
              </span>
            </button>
          </PopoverTrigger>

          <PopoverContent align="start" className="surface-card shadow-md w-64 rounded-lg p-0 overflow-hidden animate-scale-in">
            <div className="px-3 py-2.5 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Watchers
              </span>
            </div>
            {watchers.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No one is watching yet.</p>
            ) : (
              <ul role="list" className="divide-y divide-border/50">
                {watchers.map((watcher: any) => (
                  <li key={watcher.id} className="flex items-center gap-2.5 px-3 py-2">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={watcher.user.image} alt={watcher.user.name ?? ''} />
                      <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                        {watcher.user.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{watcher.user.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{watcher.user.email}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      )}

      {/* Watch / Unwatch toggle */}
      <Button
        variant={isWatching ? 'outline' : 'ghost'}
        size="sm"
        className={cn(
          'h-7 px-2.5 text-xs gap-1.5 transition-colors duration-200',
          isWatching && 'text-primary border-primary/30'
        )}
        onClick={handleToggleWatch}
        disabled={isMutating}
        aria-label={isWatching ? 'Stop watching' : 'Watch'}
      >
        {isWatching ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
        {isWatching ? 'Unwatch' : 'Watch'}
      </Button>
    </div>
  );
}
