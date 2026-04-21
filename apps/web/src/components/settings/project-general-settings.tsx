'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useDeleteProject, useProject, useUpdateProject } from '@/lib/hooks/use-projects';
import { AlertTriangle } from 'lucide-react';

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
    <div className="animate-fade-up space-y-8 stagger">
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">Project</span>
          <h2 className="text-lg font-semibold tracking-tight">General</h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Update the core project details your team sees across TaskNebula.
          </p>
        </div>
        <div className="surface-card rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <Label htmlFor="project-name" className="text-sm font-medium">
              Project name
            </Label>
            <Input
              id="project-name"
              value={formData.name}
              onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
              placeholder="Website Redesign"
              className="transition-all duration-150 ease-snap"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <div className="space-y-1">
              <Label htmlFor="project-key" className="text-sm font-medium">
                Project key
              </Label>
              <p className="text-xs text-muted-foreground">Uppercase, digits, dashes.</p>
            </div>
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
              className="transition-all duration-150 ease-snap"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <Label htmlFor="project-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="project-description"
              rows={4}
              value={formData.description}
              onChange={(event) =>
                setFormData((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Summarize the goal, scope, and audience for this project."
              className="transition-all duration-150 ease-snap"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <Label className="text-sm font-medium">Status</Label>
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

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <Label className="text-sm font-medium">Visibility</Label>
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

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="chip">
                {(project as { issueCount?: number }).issueCount || 0} issues
              </span>
              <span className="chip">
                {(project as { sprintCount?: number }).sprintCount || 0} sprints
              </span>
              {(project as { activeSprint?: { name?: string } | null }).activeSprint?.name ? (
                <span className="chip-accent">
                  Active: {(project as { activeSprint: { name: string } }).activeSprint.name}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
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
          </div>
        </div>
      </section>

      <section className="animate-fade-up space-y-4">
        <div className="space-y-1">
          <span className="kicker text-destructive">Danger zone</span>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Delete project
          </h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Blocked while the project still has issues.
          </p>
        </div>
        <div className="panel-danger animate-alert-in flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm">Deleted projects cannot be restored.</p>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteProject.isPending}
          >
            {deleteProject.isPending ? 'Deleting...' : 'Delete project'}
          </Button>
        </div>
      </section>
    </div>
  );
}
