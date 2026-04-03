'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDeleteProject, useProject, useUpdateProject } from '@/lib/hooks/use-projects';

interface ProjectGeneralSettingsProps {
  projectId: string;
}

const PROJECT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'archived', label: 'Archived' },
];

const PROJECT_VISIBILITY = [
  { value: 'private', label: 'Private' },
  { value: 'internal', label: 'Internal' },
  { value: 'public', label: 'Public' },
];

export function ProjectGeneralSettings({ projectId }: ProjectGeneralSettingsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: project, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    description: '',
    status: 'active',
    visibility: 'internal',
  });

  useEffect(() => {
    if (!project) {
      return;
    }

    setFormData({
      name: project.name || '',
      key: project.key || '',
      description: project.description || '',
      status: project.status || 'active',
      visibility: (project as { visibility?: string }).visibility || 'internal',
    });
  }, [project]);

  async function handleSave() {
    try {
      await updateProject.mutateAsync({
        projectId,
        data: {
          name: formData.name.trim(),
          key: formData.key.trim().toUpperCase(),
          description: formData.description.trim() || null,
          status: formData.status,
          visibility: formData.visibility,
        },
      });

      toast({
        title: 'Project updated',
        description: 'General settings were saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to update project',
        variant: 'destructive',
      });
    }
  }

  async function handleDelete() {
    const shouldDelete = window.confirm(
      'Delete this project permanently? This only works when the project has no issues.'
    );

    if (!shouldDelete) {
      return;
    }

    try {
      await deleteProject.mutateAsync(projectId);
      toast({
        title: 'Project deleted',
        description: 'The project was removed successfully.',
      });
      router.push('/projects');
      router.refresh();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete project',
        variant: 'destructive',
      });
    }
  }

  if (isLoading || !project) {
    return <div className="p-4 text-sm text-muted-foreground">Loading project settings...</div>;
  }

  const hasChanges =
    formData.name !== (project.name || '') ||
    formData.key !== (project.key || '') ||
    formData.description !== (project.description || '') ||
    formData.status !== project.status ||
    formData.visibility !== ((project as { visibility?: string }).visibility || 'internal');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Update the core project details your team sees across TaskNebula.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                placeholder="Website Redesign"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-key">Project key</Label>
              <Input
                id="project-key"
                value={formData.key}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    key: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                  }))
                }
                maxLength={20}
                placeholder="WEB"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              rows={4}
              value={formData.description}
              onChange={(event) =>
                setFormData((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Summarize the goal, scope, and audience for this project."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Project status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData((current) => ({ ...current, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={formData.visibility}
                onValueChange={(value) => setFormData((current) => ({ ...current, visibility: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_VISIBILITY.map((visibility) => (
                    <SelectItem key={visibility.value} value={visibility.value}>
                      {visibility.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Issues {(project as { issueCount?: number }).issueCount || 0}</Badge>
            <Badge variant="outline">Sprints {(project as { sprintCount?: number }).sprintCount || 0}</Badge>
            {(project as { activeSprint?: { name?: string } | null }).activeSprint?.name ? (
              <Badge variant="outline">Active sprint {(project as { activeSprint: { name: string } }).activeSprint.name}</Badge>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setFormData({
                  name: project.name || '',
                  key: project.key || '',
                  description: project.description || '',
                  status: project.status || 'active',
                  visibility: (project as { visibility?: string }).visibility || 'internal',
                })
              }
              disabled={!hasChanges || updateProject.isPending}
            >
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateProject.isPending || !formData.name.trim() || !formData.key.trim()}
            >
              {updateProject.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Archive or remove the project once you are sure the team no longer needs it.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="font-medium">Delete project</div>
            <p className="text-sm text-muted-foreground">
              This action is blocked while the project still has issues.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteProject.isPending}
          >
            {deleteProject.isPending ? 'Deleting...' : 'Delete project'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
