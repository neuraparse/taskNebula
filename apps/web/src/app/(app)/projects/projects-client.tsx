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
import { FolderKanban, Layers3, Plus, X, Sparkles } from 'lucide-react';
import { ViewTransition } from '@/components/ui/view-transition';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

// Deterministic accent hue per project id (stable across renders)
// Using full class names so Tailwind JIT picks them up.
const ICON_TILE_VARIANTS = [
  'icon-tile icon-tile-accent-blue',
  'icon-tile icon-tile-accent-violet',
  'icon-tile icon-tile-accent-cyan',
  'icon-tile icon-tile-accent-emerald',
  'icon-tile icon-tile-accent-amber',
  'icon-tile icon-tile-accent-rose',
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function iconTileFor(id: string): string {
  const index = hashString(id) % ICON_TILE_VARIANTS.length;
  return ICON_TILE_VARIANTS[index] ?? ICON_TILE_VARIANTS[0]!;
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

  const firstOrganizationId = orgsData?.organizations?.[0]?.id ?? null;
  useEffect(() => {
    if (!currentOrganizationId && firstOrganizationId) {
      setCurrentOrganization(firstOrganizationId);
    }
  }, [currentOrganizationId, firstOrganizationId, setCurrentOrganization]);

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
          /* FEAT-31 dashboard empty state. Illustration tile + primary CTA
             + secondary AI CTA (TODO: route once /api/ai/projects/scaffold
             lands; it should pre-fill the create-project dialog). */
          <div className="mx-auto flex max-w-md animate-fade-up flex-col items-center gap-4 rounded-lg border border-dashed border-border p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-gradient-mesh">
              <FolderKanban className="h-7 w-7 text-foreground/80" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                {activeTeamspace
                  ? `No projects in ${activeTeamspace.name} yet`
                  : 'Spin up your first project'}
              </p>
              <p className="text-sm text-muted-foreground">
                Projects collect issues, sprints, docs, and automations. You can also
                let AI scaffold one from a short description.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => setShowDialog(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Create Project
              </Button>
              <Button
                variant="outline"
                // TODO(ai): hook into /api/ai/projects/scaffold once available.
                // It should accept a 1-line goal and return a draft project
                // (name, key, description, default columns).
                onClick={() => {
                  // eslint-disable-next-line no-console
                  console.info('[ai-generate] projects empty state — TODO scaffold flow');
                  setShowDialog(true);
                }}
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Generate with AI
              </Button>
            </div>
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
              const tileClass = iconTileFor(project.id);
              const issueCount = project.issueCount ?? 0;
              const sprintCount = project.sprintCount ?? 0;
              return (
                /* FEAT-31: tile → detail morph. Pair with a matching
                   <ViewTransition name="project-${id}"> on the project home
                   page header to enable a shared-element transition. */
                <ViewTransition key={project.id} name={`project-${project.id}`}>
                <Link
                  href={`/projects/${project.key.toLowerCase()}/views`}
                  className="surface-card surface-card-hover group flex flex-col gap-3 rounded-lg p-5 transition-all duration-150 ease-snap hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`${tileClass} h-9 w-9 shrink-0 font-mono text-xs font-semibold`}
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
                  ) : null}

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
                </ViewTransition>
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
      <DialogContent className="w-full max-w-[460px] rounded-lg border border-border bg-background p-6 shadow-md">
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
