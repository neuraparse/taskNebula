'use client';

import { use } from 'react';
import { Plus, Calendar, Target, CheckCircle2, Trash2, Lock, Timer, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSprints, useDeleteSprint } from '@/lib/hooks/use-sprints';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import { CreateSprintModal } from '@/components/sprints/create-sprint-modal';
import { useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function SprintsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: sprints, isLoading } = useSprints(projectId);
  const deleteSprint = useDeleteSprint();
  const { permissions, isLoading: permissionsLoading } = useProjectPermissions(projectId);

  const handleDeleteSprint = async (sprintId: string) => {
    if (!confirm('Are you sure you want to delete this sprint?')) return;
    try {
      await deleteSprint.mutateAsync(sprintId);
    } catch (error) {
      console.error('Error deleting sprint:', error);
      alert('Failed to delete sprint. It may have assigned issues.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20 hover:bg-accent-emerald/20">
            <span className="status-dot status-live mr-1.5" />
            Active
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-accent-blue/10 text-accent-blue border-accent-blue/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            Planned
          </Badge>
        );
    }
  };

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading sprints...</div>
      </div>
    );
  }

  if (!permissions.canBrowseProject && !permissions.isSuperAdmin && !permissions.isOrgOwner) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <div className="text-lg font-medium">Access Denied</div>
        <div className="text-muted-foreground">You don&apos;t have permission to view this project.</div>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto animate-fade-in">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sprints</h1>
            <p className="text-sm text-muted-foreground">Plan and manage your project sprints</p>
          </div>
          {permissions.canManageSprints && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Sprint
            </Button>
          )}
        </div>

        {/* Sprint List */}
        {sprints && sprints.length > 0 ? (
          <div className="stagger space-y-3">
            {sprints.map((sprint) => {
              const startDate = new Date(sprint.startDate);
              const endDate = new Date(sprint.endDate);
              const now = Date.now();
              const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
              const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now) / (1000 * 60 * 60 * 24)));
              const progress = sprint.status === 'active'
                ? Math.min(100, Math.max(0, ((now - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100))
                : sprint.status === 'completed' ? 100 : 0;

              return (
                <div
                  key={sprint.id}
                  className={cn(
                    'surface-card surface-card-hover group rounded-lg transition-all duration-150 ease-snap',
                    sprint.status === 'active' && 'border-accent-emerald/20'
                  )}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-2">
                          <Link
                            href={`/projects/${projectId}/sprints/${sprint.id}`}
                            className="text-base font-semibold hover:text-primary transition-colors"
                          >
                            {sprint.name}
                          </Link>
                          {getStatusBadge(sprint.status)}
                        </div>

                        {sprint.goal && (
                          <p className="text-sm text-muted-foreground mb-3 flex items-start gap-1.5">
                            <Target className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />
                            {sprint.goal}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
                          </span>
                          <span>{totalDays} days</span>
                          <span>{sprint.issueCount || 0} issues</span>
                          {sprint.status === 'active' && daysLeft > 0 && (
                            <span className={cn(
                              'font-medium',
                              daysLeft <= 3 ? 'text-accent-amber' : 'text-accent-emerald'
                            )}>
                              {daysLeft}d remaining
                            </span>
                          )}
                        </div>

                        {sprint.status === 'active' && (
                          <div className="mt-3 flex items-center gap-3">
                            <div className="flex-1 h-1.5 overflow-hidden rounded-sm bg-primary/10">
                              <div
                                className="h-full rounded-sm bg-primary transition-all duration-150 ease-snap"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground tabular-nums w-8">
                              {Math.round(progress)}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link href={`/projects/${projectId}/sprints/${sprint.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
                            View
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                        {permissions.canDeleteSprint && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteSprint(sprint.id)}
                            disabled={deleteSprint.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mx-auto flex max-w-md animate-fade-up flex-col items-center gap-3 rounded-lg border border-dashed border-border p-8 text-center">
            <Timer className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {permissions.canManageSprints
                ? 'No sprints yet. Create your first to plan iteration.'
                : 'No sprints have been created for this project yet.'}
            </p>
            {permissions.canManageSprints && (
              <Button size="sm" variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create Sprint
              </Button>
            )}
          </div>
        )}
      </div>

      <CreateSprintModal
        projectId={projectId}
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </div>
  );
}
