'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useUser } from '@/lib/hooks/use-user';

interface WatchersListProps {
  issueId?: string;
  projectId?: string;
}

export function WatchersList({ issueId, projectId }: WatchersListProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  // Fetch watchers
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

  // Add watcher mutation
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

  // Remove watcher mutation
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Watchers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Watchers</CardTitle>
            <CardDescription className="text-xs">
              {watchers.length} {watchers.length === 1 ? 'person' : 'people'} watching
            </CardDescription>
          </div>
          <Button
            variant={isWatching ? 'outline' : 'default'}
            size="sm"
            onClick={handleToggleWatch}
            disabled={addWatcher.isPending || removeWatcher.isPending}
          >
            {isWatching ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Unwatch
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Watch
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {watchers.length === 0 ? (
          <div className="text-center py-6">
            <UserPlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No watchers yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click &quot;Watch&quot; to receive notifications
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {watchers.map((watcher: any) => (
              <div key={watcher.id} className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={watcher.user.image} />
                  <AvatarFallback className="text-xs">
                    {watcher.user.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{watcher.user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {watcher.user.email}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

