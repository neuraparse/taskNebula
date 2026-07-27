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
import { FolderKanban, Layers3, Plus, X } from 'lucide-react';
import { ViewTransition } from '@/components/ui/view-transition';
import { PageFrame } from '@/components/ui/page-frame';
import { PageHeader } from '@/components/ui/page-header';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function ProjectsClient() {
  const t = useTranslations('pagesProjects');
  const errorT = useTranslations('componentErrors.projects');
  const [showDialog, setShowDialog] = useState(false);
  const { currentOrganizationId, currentTeamId, setCurrentOrganization } = useOrganization();

  const { data: orgsData } = useQuery<{ organizations: Organization[] }>({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await fetch('/api/organizations');
      if (!response.ok) throw new Error(errorT('fetchOrganizations'));
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
    <>
      <PageFrame className="animate-fade-in">
        <PageHeader
          kicker={t('kicker')}
          title={t('title')}
          description={
            isProjectListLoading
              ? t('loading')
              : activeTeamspace
                ? t('activeCountInTeamspace', {
                    count: projects.length,
                    teamspace: activeTeamspace.name,
                  })
                : t('activeCount', { count: projects.length })
          }
          actions={
            canCreateProject ? (
              <Button className="w-full sm:w-auto" onClick={() => setShowDialog(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t('createProject')}
              </Button>
            ) : null
          }
        />

        {projects.length === 0 && !isProjectListLoading ? (
          /* FEAT-31 dashboard empty state. Keep one honest primary action until
             AI project scaffolding has a complete, reviewable workflow. */
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
              <Button onClick={() => setShowDialog(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t('createProject')}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="surface-card divide-border w-full divide-y overflow-hidden shadow-none">
            {projects.map((project) => {
              const initials = project.name
                .split(/\s+/)
                .slice(0, 2)
                .map((w: string) => w[0])
                .join('')
                .toUpperCase();
              const issueCount = project.issueCount ?? 0;
              const sprintCount = project.sprintCount ?? 0;
              return (
                /* FEAT-31: tile → detail morph. Pair with a matching
                   <ViewTransition name="project-${id}"> on the project home
                   page header to enable a shared-element transition. */
                <ViewTransition key={project.id} name={`project-${project.id}`}>
                  <Link
                    href={`/projects/${project.key.toLowerCase()}/views`}
                    className="hover:bg-surface/60 focus-visible:bg-surface group grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors duration-150 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                  >
                    <span className="border-border bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <p className="text-foreground group-hover:text-primary truncate text-sm font-semibold leading-tight transition-colors">
                          {project.name}
                        </p>
                        <span className="text-muted-foreground shrink-0 font-mono text-[11px] uppercase tracking-[0.08em]">
                          {project.key}
                        </span>
                      </div>
                      {project.description ? (
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {project.description}
                        </p>
                      ) : project.team ? (
                        <p className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 truncate text-xs">
                          <Layers3 className="h-3 w-3" />
                          {project.team.name}
                        </p>
                      ) : null}
                    </div>

                    <div className="text-muted-foreground col-start-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs sm:col-auto sm:justify-end">
                      {project.team && project.description ? (
                        <>
                          <span className="hidden items-center gap-1 lg:inline-flex">
                            <Layers3 className="h-3 w-3" />
                            {project.team.name}
                          </span>
                          <span className="hidden opacity-40 lg:inline">·</span>
                        </>
                      ) : null}
                      <span className="text-foreground font-medium tabular-nums">{issueCount}</span>
                      <span>{t('issueLabel', { count: issueCount })}</span>
                      <span className="opacity-40">·</span>
                      <span className="text-foreground font-medium tabular-nums">
                        {sprintCount}
                      </span>
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
      </PageFrame>

      {canCreateProject ? (
        <CreateProjectDialog open={showDialog} onOpenChange={(open) => setShowDialog(open)} />
      ) : null}
    </>
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
              placeholder={t('projectKeyPlaceholder')}
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
