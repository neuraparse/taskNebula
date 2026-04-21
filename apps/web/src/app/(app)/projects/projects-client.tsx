'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateProject, useProjects } from '@/lib/hooks/use-projects';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useTeamspaces } from '@/lib/hooks/use-teamspaces';
import { FolderKanban, Layers3, Plus, X } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function ProjectsClient() {
  const [showDialog, setShowDialog] = useState(false);
  const { currentOrganizationId, currentTeamId, setCurrentOrganization } = useOrganization();

  const { data: orgsData } = useQuery<{ organizations: Organization[] }>({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await fetch('/api/organizations');
      if (!response.ok) throw new Error('Failed to fetch organizations');
      return response.json();
    },
  });

  useEffect(() => {
    const firstOrganization = orgsData?.organizations?.[0];
    if (!currentOrganizationId && firstOrganization) {
      setCurrentOrganization(firstOrganization.id);
    }
  }, [currentOrganizationId, orgsData, setCurrentOrganization]);

  const { data: teamspaces = [] } = useTeamspaces(currentOrganizationId);
  const { data: projects = [], isLoading } = useProjects({
    organizationId: currentOrganizationId,
    teamId: currentTeamId,
  });

  const activeTeamspace = useMemo(
    () => teamspaces.find((teamspace) => teamspace.id === currentTeamId) ?? null,
    [currentTeamId, teamspaces]
  );

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? 'Loading projects...'
                : `${projects.length} active project${projects.length !== 1 ? 's' : ''}${
                    activeTeamspace ? ` in ${activeTeamspace.name}` : ''
                  }`}
            </p>
          </div>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create Project
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {projects.length === 0 && !isLoading ? (
          <div className="surface-card p-8 text-center border-dashed">
            <p className="text-sm font-medium">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeTeamspace
                ? `Create the first project inside ${activeTeamspace.name}.`
                : 'Create your first project to get started.'}
            </p>
            <Button className="mt-4" onClick={() => setShowDialog(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const initials = project.name
                .split(/\s+/)
                .slice(0, 2)
                .map((w: string) => w[0])
                .join('')
                .toUpperCase();
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.key.toLowerCase()}/views`}
                  className="surface-card surface-card-hover group flex flex-col gap-3 p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-primary font-mono text-xs font-semibold text-primary-foreground">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
                        {project.name}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">{project.key}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {project.team ? (
                      <span className="flex items-center gap-1">
                        <Layers3 className="h-3 w-3" />
                        {project.team.name}
                      </span>
                    ) : (
                      <span>{project.organizationName}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={showDialog}
        onOpenChange={(open) => setShowDialog(open)}
      />
    </div>
  );
}

function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const onClose = () => onOpenChange(false);
  const router = useRouter();
  const createProject = useCreateProject();
  const { currentOrganizationId, currentTeamId } = useOrganization();
  const { data: teamspaces = [] } = useTeamspaces(currentOrganizationId);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState<string>(currentTeamId ?? 'none');
  const [keyManual, setKeyManual] = useState(false);

  useEffect(() => {
    setTeamId(currentTeamId ?? 'none');
  }, [currentTeamId]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!keyManual) {
      const autoKey = value
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 6);
      setKey(autoKey);
    }
  };

  const handleKeyChange = (value: string) => {
    setKeyManual(true);
    setKey(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !key.trim()) return;

    try {
      await createProject.mutateAsync({
        name: name.trim(),
        key: key.trim(),
        description: description.trim() || undefined,
        organizationId: currentOrganizationId,
        teamId: teamId === 'none' ? null : teamId,
      });
      onClose();
      router.refresh();
    } catch {
      // handled by mutation state
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[460px] border border-border bg-background p-6 shadow-md">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-semibold">Create Project</DialogTitle>
            <DialogDescription className="mt-1 text-xs text-muted-foreground">
              Projects inherit the current organization and can optionally live in a teamspace.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="project-name" className="text-sm font-medium">
              Project Name
            </label>
            <Input
              id="project-name"
              placeholder="My Awesome Project"
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="project-key" className="text-sm font-medium">
              Project Key
            </label>
            <Input
              id="project-key"
              placeholder="MAP"
              value={key}
              onChange={(event) => handleKeyChange(event.target.value)}
              required
              maxLength={10}
              className="uppercase"
            />
            <p className="text-xs text-muted-foreground">
              Used as issue prefix, for example {key || 'KEY'}-1.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="project-teamspace" className="text-sm font-medium">
              Teamspace
            </label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger id="project-teamspace">
                <SelectValue placeholder="No teamspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No teamspace</SelectItem>
                {teamspaces.map((teamspace) => (
                  <SelectItem key={teamspace.id} value={teamspace.id}>
                    {teamspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use teamspaces to group related projects without creating a duplicate top-level entity.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="project-desc" className="text-sm font-medium">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="project-desc"
              placeholder="Brief project description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {createProject.error ? (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {createProject.error.message}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProject.isPending || !name.trim() || !key.trim()}
            >
              {createProject.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
