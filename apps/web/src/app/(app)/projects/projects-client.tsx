'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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

// Deterministic accent hue per project id (stable across renders)
// Using full class names so Tailwind JIT picks them up.
const ACCENT_VARIANTS = [
  {
    stripe: 'bg-gradient-to-r from-accent-blue/40 to-transparent',
    avatar: 'bg-accent-blue/10 text-accent-blue',
  },
  {
    stripe: 'bg-gradient-to-r from-accent-violet/40 to-transparent',
    avatar: 'bg-accent-violet/10 text-accent-violet',
  },
  {
    stripe: 'bg-gradient-to-r from-accent-cyan/40 to-transparent',
    avatar: 'bg-accent-cyan/10 text-accent-cyan',
  },
  {
    stripe: 'bg-gradient-to-r from-accent-emerald/40 to-transparent',
    avatar: 'bg-accent-emerald/10 text-accent-emerald',
  },
  {
    stripe: 'bg-gradient-to-r from-accent-amber/40 to-transparent',
    avatar: 'bg-accent-amber/10 text-accent-amber',
  },
  {
    stripe: 'bg-gradient-to-r from-accent-rose/40 to-transparent',
    avatar: 'bg-accent-rose/10 text-accent-rose',
  },
  {
    stripe: 'bg-gradient-to-r from-accent-indigo/40 to-transparent',
    avatar: 'bg-accent-indigo/10 text-accent-indigo',
  },
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function accentFor(id: string): (typeof ACCENT_VARIANTS)[number] {
  const index = hashString(id) % ACCENT_VARIANTS.length;
  return ACCENT_VARIANTS[index] ?? ACCENT_VARIANTS[0]!;
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
      <div className="border-b border-border bg-background px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="kicker">Workspace</span>
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
          <div className="mx-auto max-w-md animate-fade-up rounded-lg border border-dashed border-border p-8 text-center">
            <FolderKanban className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {activeTeamspace
                ? `No projects in ${activeTeamspace.name} yet.`
                : 'No projects yet. Create your first to get started.'}
            </p>
            <Button className="mt-4" onClick={() => setShowDialog(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const initials = project.name
                .split(/\s+/)
                .slice(0, 2)
                .map((w: string) => w[0])
                .join('')
                .toUpperCase();
              const accent = accentFor(project.id);
              const issueCount = project.issueCount ?? 0;
              const sprintCount = project.sprintCount ?? 0;
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.key.toLowerCase()}/views`}
                  className="surface-card surface-card-hover group relative flex flex-col gap-4 overflow-hidden p-5 transition-all duration-200 ease-smooth hover:-translate-y-0.5"
                >
                  {/* Accent stripe (top) */}
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 ${accent.stripe}`}
                  />

                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold ${accent.avatar}`}
                    >
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                        {project.name}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {project.key}
                        {project.team ? (
                          <>
                            <span className="mx-1.5 opacity-40">·</span>
                            <span className="inline-flex items-center gap-1 font-sans">
                              <Layers3 className="h-3 w-3" />
                              {project.team.name}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  {project.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                  ) : (
                    <p className="line-clamp-2 text-sm text-muted-foreground/60 italic">
                      No description
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{issueCount}</span>
                    <span>issue{issueCount === 1 ? '' : 's'}</span>
                    <span className="opacity-40">·</span>
                    <span className="font-medium text-foreground">{sprintCount}</span>
                    <span>sprint{sprintCount === 1 ? '' : 's'}</span>
                    {project.activeSprint ? (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="status-dot status-live" />
                          <span className="truncate text-accent-emerald">
                            {project.activeSprint.name}
                          </span>
                        </span>
                      </>
                    ) : null}
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
            className="rounded-md p-1 transition-colors hover:bg-muted"
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
