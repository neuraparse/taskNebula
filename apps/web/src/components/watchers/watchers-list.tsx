'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Eye, EyeOff } from 'lucide-react';
import { useUser } from '@/lib/hooks/use-user';
import { cn } from '@/lib/utils';

interface WatchersListProps {
  issueId?: string;
  projectId?: string;
}

interface Watcher {
  id: string;
  userId: string;
  user: {
    name: string | null;
    image: string | null;
  };
}

export function WatchersList({ issueId, projectId }: WatchersListProps) {
  const t = useTranslations('projectConfig');
  const errorT = useTranslations('componentErrors.watchers');
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
      if (!response.ok) throw new Error(errorT('fetch'));
      return response.json();
    },
    enabled: !!(issueId || projectId),
  });

  const watchers = (data?.watchers || []) as Watcher[];
  const isWatching = watchers.some((watcher) => watcher.userId === user?.id);

  // Add watcher mutation — API call untouched.
  const addWatcher = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/watchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, projectId }),
      });
      if (!response.ok) throw new Error(errorT('add'));
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
      if (!response.ok) throw new Error(errorT('remove'));
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
              className="text-muted-foreground hover:text-foreground ease-snap focus-visible:ring-ring flex items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              aria-label={t('watchers_count_label', { count: watchers.length })}
            >
              {/* Overlapping avatar stack */}
              {watchers.length > 0 && (
                <span className="flex items-center" aria-hidden="true">
                  {visibleAvatars.map((watcher) => (
                    <Avatar
                      key={watcher.id}
                      className="ring-background -ml-2 h-5 w-5 ring-2 first:ml-0"
                    >
                      <AvatarImage
                        src={watcher.user.image ?? undefined}
                        alt={watcher.user.name ?? ''}
                      />
                      <AvatarFallback className="bg-muted text-muted-foreground text-[9px]">
                        {watcher.user.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {overflowCount > 0 && (
                    <span className="ring-background bg-muted text-muted-foreground -ml-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold ring-2">
                      +{overflowCount}
                    </span>
                  )}
                </span>
              )}
              <span>
                {isLoading
                  ? t('loading')
                  : watchers.length === 0
                    ? t('no_watchers')
                    : t('watching_count', { count: watchers.length })}
              </span>
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            className="surface-card animate-pop-in w-64 overflow-hidden rounded-lg p-0 shadow-md"
          >
            <div className="border-border/60 border-b px-4 py-2.5">
              <span className="kicker">{t('watchers')}</span>
            </div>
            {watchers.length === 0 ? (
              <p className="text-muted-foreground px-4 py-4 text-sm">{t('no_one_watching')}</p>
            ) : (
              <ul role="list" className="stagger">
                {watchers.map((watcher) => (
                  <li key={watcher.id} className="flex items-center gap-2.5 px-3 py-1.5">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage
                        src={watcher.user.image ?? undefined}
                        alt={watcher.user.name ?? ''}
                      />
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {watcher.user.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{watcher.user.name}</p>
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
          'ease-snap h-7 gap-1.5 rounded-md px-2.5 text-xs transition-colors duration-150',
          isWatching && 'text-primary border-primary/30'
        )}
        onClick={handleToggleWatch}
        disabled={isMutating}
        aria-label={isWatching ? t('stop_watching') : t('watch')}
      >
        {isWatching ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {isWatching ? t('unwatch') : t('watch')}
      </Button>
    </div>
  );
}
