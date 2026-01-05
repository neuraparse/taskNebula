'use client';

import { use } from 'react';
import { Plus, Calendar, Target, PlayCircle, CheckCircle2, Trash2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSprints, useDeleteSprint } from '@/lib/hooks/use-sprints';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import { CreateSprintModal } from '@/components/sprints/create-sprint-modal';
import { useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <PlayCircle className="h-4 w-4 text-green-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      default:
        return <Calendar className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500">Completed</Badge>;
      default:
        return <Badge variant="outline">Planned</Badge>;
    }
  };

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading sprints...</div>
      </div>
    );
  }

  // Check if user has access to view this project
  if (!permissions.canBrowseProject && !permissions.isSuperAdmin && !permissions.isOrgOwner) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <div className="text-lg font-medium">Access Denied</div>
        <div className="text-muted-foreground">You don't have permission to view this project.</div>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sprints</h1>
            <p className="text-muted-foreground">Plan and manage your project sprints</p>
          </div>
          {permissions.canManageSprints && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Sprint
            </Button>
          )}
        </div>

        {/* Sprints List */}
        {sprints && sprints.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sprints.map((sprint) => (
              <Card key={sprint.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(sprint.status)}
                      <CardTitle className="text-lg">{sprint.name}</CardTitle>
                    </div>
                    {getStatusBadge(sprint.status)}
                  </div>
                  {sprint.goal && (
                    <CardDescription className="flex items-start gap-2">
                      <Target className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{sprint.goal}</span>
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Dates */}
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {format(new Date(sprint.startDate), 'MMM d')} -{' '}
                        {format(new Date(sprint.endDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {sprint.issueCount || 0} issues
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link href={`/projects/${projectId}/sprints/${sprint.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        View Sprint
                      </Button>
                    </Link>
                    {permissions.canDeleteSprint && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSprint(sprint.id)}
                        disabled={deleteSprint.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No sprints yet</h3>
              <p className="text-muted-foreground mb-4">
                {permissions.canManageSprints
                  ? 'Create your first sprint to get started'
                  : 'No sprints have been created for this project yet'}
              </p>
              {permissions.canManageSprints && (
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Sprint
                </Button>
              )}
            </CardContent>
          </Card>
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

