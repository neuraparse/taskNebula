'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { isApiPermissionError } from '@/lib/client-api-errors';
import { useCreateProject, useProjects } from '@/lib/hooks/use-projects';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useOrganizationPermissions } from '@/lib/hooks/use-permissions';
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
  const t = useTranslations('pagesProjects');
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
  const { has: hasOrgPermission, isLoading: permissionsLoading } = useOrganizationPermissions(
    currentOrganizationId ?? undefined
  );
  const canCreateProject = !permissionsLoading && hasOrgPermission('project:create');

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
  const isProjectListLoading = isLoading || permissionsLoading;

  const activeTeamspace = useMemo(
    () => teamspaces.find((teamspace) => teamspace.id === currentTeamId) ?? null,
    [currentTeamId, teamspaces]
  );

  return (
    <div className="bg-background animate-fade-in flex h-full flex-col">
      <div className="border-border bg-card border-b px-6 py-5">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="kicker">{t('kicker')}</span>
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">
              {isProjectListLoading
                ? t('loading')
                : activeTeamspace
                  ? t('activeCountInTeamspace', {
                      count: projects.length,
                      teamspace: activeTeamspace.name,
                    })
                  : t('activeCount', { count: projects.length })}
            </p>
          </div>
          {canCreateProject ? (
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('createProject')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {projects.length === 0 && !isProjectListLoading ? (
          /* FEAT-31 dashboard empty state. Illustration tile + primary CTA
             + secondary AI CTA (TODO: route once /api/ai/projects/scaffold
             lands; it should pre-fill the create-project dialog). */
          <div className="surface-card animate-fade-up mx-auto flex max-w-md flex-col items-center gap-4 border-dashed p-10 text-center shadow-none">
            <div className="icon-tile icon-tile-accent-blue flex h-14 w-14 items-center justify-center">
              <FolderKanban className="text-foreground/80 h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-foreground text-base font-semibold">
                {!canCreateProject
                  ? t('projectInviteRequiredTitle')
                  : activeTeamspace
                    ? t('emptyTitleTeamspace', { teamspace: activeTeamspace.name })
                    : t('emptyTitle')}
              </p>
              <p className="text-muted-foreground text-sm">
                {canCreateProject ? t('emptyDescription') : t('projectInviteRequiredDescription')}
              </p>
            </div>
            {canCreateProject ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => setShowDialog(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  {t('createProject')}
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
                  {t('generateWithAi')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="stagger mx-auto grid w-full max-w-[1600px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    className="surface-card ease-snap border-t-primary hover:border-border-strong hover:bg-surface/50 group flex min-h-[176px] flex-col gap-3 border-t-2 p-5 shadow-none transition-colors duration-150"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`${tileClass} h-9 w-9 shrink-0 font-mono text-xs font-semibold`}
                      >
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground group-hover:text-primary truncate text-sm font-semibold leading-tight transition-colors">
                          {project.name}
                        </p>
                        <p className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.08em]">
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
                      <p className="text-muted-foreground line-clamp-2 text-sm">
                        {project.description}
                      </p>
                    ) : null}

                    <div className="text-muted-foreground border-border mt-auto flex flex-wrap items-center gap-1.5 border-t pt-3 text-xs">
                      <span className="text-foreground font-medium">{issueCount}</span>
                      <span>{t('issueLabel', { count: issueCount })}</span>
                      <span className="opacity-40">·</span>
                      <span className="text-foreground font-medium">{sprintCount}</span>
                      <span>{t('sprintLabel', { count: sprintCount })}</span>
                      {project.activeSprint ? (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="inline-flex items-center gap-1">
                            <span className="status-dot status-live" />
                            <span className="text-accent-emerald truncate">
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

      {canCreateProject ? (
        <CreateProjectDialog open={showDialog} onOpenChange={(open) => setShowDialog(open)} />
      ) : null}
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
  const t = useTranslations('pagesProjects');
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
  const createProjectError = createProject.error
    ? isApiPermissionError(createProject.error)
      ? t('projectInviteRequiredDescription')
      : t('createProjectFailed')
    : null;

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
    setKey(
      value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10)
    );
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
      <DialogContent className="border-border bg-background w-full max-w-[460px] rounded-lg border p-6 shadow-md">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-semibold">{t('createProject')}</DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1 text-xs">
              {t('dialogDescription')}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-muted rounded-md p-1 transition-colors"
            aria-label={t('closeDialog')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="project-name" className="text-sm font-medium">
              {t('projectName')}
            </label>
            <Input
              id="project-name"
              placeholder={t('projectNamePlaceholder')}
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="project-key" className="text-sm font-medium">
              {t('projectKey')}
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
            <p className="text-muted-foreground text-xs">
              {t('projectKeyHelp', { example: key || 'KEY' })}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="project-teamspace" className="text-sm font-medium">
              {t('teamspace')}
            </label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger id="project-teamspace">
                <SelectValue placeholder={t('noTeamspace')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('noTeamspace')}</SelectItem>
                {teamspaces.map((teamspace) => (
                  <SelectItem key={teamspace.id} value={teamspace.id}>
                    {teamspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">{t('teamspaceHelp')}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="project-desc" className="text-sm font-medium">
              {t.rich('descriptionLabel', {
                optional: (chunks) => <span className="text-muted-foreground">{chunks}</span>,
              })}
            </label>
            <Input
              id="project-desc"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {createProjectError ? (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {createProjectError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={createProject.isPending || !name.trim() || !key.trim()}>
              {createProject.isPending ? t('creating') : t('createProject')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
