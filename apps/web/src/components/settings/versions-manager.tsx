'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Rocket,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

type VersionStatus = 'unreleased' | 'released' | 'archived';

export interface ProjectVersion {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description: string | null;
  status: VersionStatus;
  startDate: string | null;
  releaseDate: string | null;
  releasedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  issueCount: number;
  doneIssueCount: number;
}

interface VersionsResponse {
  versions: ProjectVersion[];
  total: number;
}

class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function throwApiError(response: Response): Promise<never> {
  let message = `Request failed (${response.status})`;
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) message = data.error;
  } catch {
    // Non-JSON error body — keep the generic message.
  }
  throw new ApiError(message, response.status);
}

function useProjectVersions(projectId: string) {
  return useQuery({
    queryKey: ['project-versions', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/versions`);
      if (!response.ok) await throwApiError(response);
      return (await response.json()) as VersionsResponse;
    },
    enabled: Boolean(projectId),
  });
}

interface VersionPayload {
  name?: string;
  description?: string | null;
  startDate?: string | null;
  releaseDate?: string | null;
  status?: VersionStatus;
}

function useCreateVersion(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: VersionPayload & { name: string }) => {
      const response = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response);
      return (await response.json()) as { version: ProjectVersion };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-versions', projectId] });
    },
  });
}

function useUpdateVersion(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, ...data }: VersionPayload & { versionId: string }) => {
      const response = await fetch(`/api/projects/${projectId}/versions/${versionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiError(response);
      return (await response.json()) as { version: ProjectVersion };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-versions', projectId] });
    },
  });
}

function useDeleteVersion(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const response = await fetch(`/api/projects/${projectId}/versions/${versionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) await throwApiError(response);
      return (await response.json()) as { success: boolean };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-versions', projectId] });
    },
  });
}

function useReleaseVersion(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      versionId,
      moveOpenIssuesToVersionId,
    }: {
      versionId: string;
      moveOpenIssuesToVersionId?: string;
    }) => {
      const response = await fetch(`/api/projects/${projectId}/versions/${versionId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moveOpenIssuesToVersionId ? { moveOpenIssuesToVersionId } : {}),
      });
      if (!response.ok) await throwApiError(response);
      return (await response.json()) as { version: ProjectVersion; movedIssueCount: number };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-versions', projectId] });
    },
  });
}

const STATUS_GROUPS: ReadonlyArray<{
  status: VersionStatus;
  i18nKey: 'group_unreleased' | 'group_released' | 'group_archived';
}> = [
  { status: 'unreleased', i18nKey: 'group_unreleased' },
  { status: 'released', i18nKey: 'group_released' },
  { status: 'archived', i18nKey: 'group_archived' },
];

export interface VersionsManagerProps {
  projectId: string;
}

export function VersionsManager({ projectId }: VersionsManagerProps) {
  const t = useTranslations('settings.versions');
  const tActions = useTranslations('actions');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<ProjectVersion | null>(null);
  const [releasingVersion, setReleasingVersion] = useState<ProjectVersion | null>(null);
  const [deletingVersion, setDeletingVersion] = useState<ProjectVersion | null>(null);

  const { data, isLoading } = useProjectVersions(projectId);
  const updateVersion = useUpdateVersion(projectId);
  const deleteVersion = useDeleteVersion(projectId);

  const versions = useMemo(() => data?.versions ?? [], [data]);
  const groups = useMemo(
    () =>
      STATUS_GROUPS.map((group) => ({
        ...group,
        versions: versions.filter((version) => version.status === group.status),
      })).filter((group) => group.versions.length > 0),
    [versions]
  );
  const unreleasedVersions = useMemo(
    () => versions.filter((version) => version.status === 'unreleased'),
    [versions]
  );

  const formatDate = (value: string | null) =>
    value ? format.dateTime(new Date(value), { dateStyle: 'medium' }) : null;

  const handleStatusChange = async (version: ProjectVersion, status: VersionStatus) => {
    try {
      await updateVersion.mutateAsync({ versionId: version.id, status });
      toast({
        title: status === 'archived' ? t('toast_archived') : t('toast_restored'),
        variant: 'success',
      });
    } catch {
      toast({ title: t('error_generic'), variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deletingVersion) return;
    try {
      await deleteVersion.mutateAsync(deletingVersion.id);
      toast({ title: t('toast_deleted'), variant: 'success' });
      setDeletingVersion(null);
    } catch {
      toast({ title: t('error_generic'), variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="surface-card p-5">
        <span className="kicker">{t('kicker')}</span>
        <p className="text-muted-foreground mt-2 text-sm">{tCommon('loading')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="surface-card animate-fade-up space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="kicker">{t('kicker')}</span>
            <h3 className="text-sm font-semibold tracking-tight">{t('title')}</h3>
            <p className="text-muted-foreground text-xs">{t('subtitle')}</p>
          </div>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('new_version')}
          </Button>
        </div>

        {versions.length === 0 ? (
          <div className="space-y-2 py-10 text-center">
            <Rocket className="text-muted-foreground/40 mx-auto h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
            <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('create_first')}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.status} className="space-y-1">
                <h4 className="text-muted-foreground flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide">
                  {t(group.i18nKey)}
                  <span className="border-border bg-muted rounded-sm border px-1.5 py-0.5 text-[10px] font-medium">
                    {group.versions.length}
                  </span>
                </h4>
                <div className="stagger divide-border/60 -mx-1 divide-y">
                  {group.versions.map((version) => {
                    const progressValue =
                      version.issueCount > 0
                        ? Math.round((version.doneIssueCount / version.issueCount) * 100)
                        : 0;
                    const startDate = formatDate(version.startDate);
                    const releaseDate = formatDate(version.releaseDate);
                    const releasedAt = formatDate(version.releasedAt);

                    return (
                      <div
                        key={version.id}
                        className="row-interactive group flex items-center gap-3 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{version.name}</span>
                            {version.status === 'released' && releasedAt && (
                              <span className="border-accent-emerald/20 bg-accent-emerald/10 text-accent-emerald inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium">
                                {t('released_on', { date: releasedAt })}
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {version.description ||
                              [
                                startDate ? `${t('start_date_label')}: ${startDate}` : null,
                                releaseDate ? `${t('release_date_label')}: ${releaseDate}` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                          </p>
                        </div>

                        <div className="hidden shrink-0 items-center gap-2 sm:flex">
                          {version.issueCount > 0 ? (
                            <>
                              <Progress value={progressValue} className="h-1.5 w-24" />
                              <span className="text-muted-foreground w-24 text-right text-xs tabular-nums">
                                {t('progress', {
                                  done: version.doneIssueCount,
                                  total: version.issueCount,
                                })}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">{t('no_issues')}</span>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              aria-label={`${t('title')}: ${version.name}`}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingVersion(version)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              {t('action_edit')}
                            </DropdownMenuItem>
                            {version.status === 'unreleased' && (
                              <DropdownMenuItem onClick={() => setReleasingVersion(version)}>
                                <Rocket className="mr-2 h-3.5 w-3.5" />
                                {t('action_release')}
                              </DropdownMenuItem>
                            )}
                            {version.status !== 'archived' ? (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(version, 'archived')}
                              >
                                <Archive className="mr-2 h-3.5 w-3.5" />
                                {t('action_archive')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(version, 'unreleased')}
                              >
                                <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                                {t('action_restore')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeletingVersion(version)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              {t('action_delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <VersionEditorDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        projectId={projectId}
      />
      <VersionEditorDialog
        open={Boolean(editingVersion)}
        onOpenChange={(open) => {
          if (!open) setEditingVersion(null);
        }}
        projectId={projectId}
        versionToEdit={editingVersion}
      />
      <ReleaseVersionDialog
        open={Boolean(releasingVersion)}
        onOpenChange={(open) => {
          if (!open) setReleasingVersion(null);
        }}
        projectId={projectId}
        version={releasingVersion}
        moveTargets={unreleasedVersions.filter((v) => v.id !== releasingVersion?.id)}
      />

      <Dialog
        open={Boolean(deletingVersion)}
        onOpenChange={(open) => {
          if (!open) setDeletingVersion(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('delete_title')}</DialogTitle>
            <DialogDescription>
              {t('delete_warning', { name: deletingVersion?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingVersion(null)}>
              {tActions('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteVersion.isPending}
            >
              {deleteVersion.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('delete_submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** `timestamp` JSON string → `<input type="date">` value (YYYY-MM-DD). */
function toDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

interface VersionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  versionToEdit?: ProjectVersion | null;
}

function VersionEditorDialog({
  open,
  onOpenChange,
  projectId,
  versionToEdit,
}: VersionEditorDialogProps) {
  const t = useTranslations('settings.versions');
  const tActions = useTranslations('actions');
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [releaseDate, setReleaseDate] = useState('');

  const createVersion = useCreateVersion(projectId);
  const updateVersion = useUpdateVersion(projectId);

  const isEditMode = Boolean(versionToEdit);
  const isPending = createVersion.isPending || updateVersion.isPending;

  useEffect(() => {
    if (!open) return;

    if (versionToEdit) {
      setName(versionToEdit.name);
      setDescription(versionToEdit.description ?? '');
      setStartDate(toDateInputValue(versionToEdit.startDate));
      setReleaseDate(toDateInputValue(versionToEdit.releaseDate));
      return;
    }

    setName('');
    setDescription('');
    setStartDate('');
    setReleaseDate('');
  }, [versionToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const payload = {
      name: trimmedName,
      description: description.trim() ? description.trim() : null,
      startDate: startDate || null,
      releaseDate: releaseDate || null,
    };

    try {
      if (versionToEdit) {
        await updateVersion.mutateAsync({ versionId: versionToEdit.id, ...payload });
        toast({ title: t('toast_updated'), variant: 'success' });
      } else {
        await createVersion.mutateAsync(payload);
        toast({ title: t('toast_created'), variant: 'success' });
      }
      onOpenChange(false);
    } catch (error) {
      const isDuplicate = error instanceof ApiError && error.status === 409;
      toast({
        title: isDuplicate ? t('error_duplicate') : t('error_generic'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? t('edit_title') : t('create_title')}</DialogTitle>
            <DialogDescription>
              {isEditMode ? t('edit_description') : t('create_description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="version-name">
                {t('name_label')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="version-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('name_placeholder')}
                maxLength={120}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="version-start-date">{t('start_date_label')}</Label>
                <Input
                  id="version-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version-release-date">{t('release_date_label')}</Label>
                <Input
                  id="version-release-date"
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="version-description">
                {t('description_label')}{' '}
                <span className="text-muted-foreground font-normal">
                  {t('description_optional')}
                </span>
              </Label>
              <Textarea
                id="version-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('description_placeholder')}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tActions('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? t('save_submit') : t('create_submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ReleaseVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  version: ProjectVersion | null;
  /** Other unreleased versions of this project open issues can move to. */
  moveTargets: ProjectVersion[];
}

function ReleaseVersionDialog({
  open,
  onOpenChange,
  projectId,
  version,
  moveTargets,
}: ReleaseVersionDialogProps) {
  const t = useTranslations('settings.versions');
  const tActions = useTranslations('actions');
  const { toast } = useToast();

  const [moveTargetId, setMoveTargetId] = useState<string>('none');
  const releaseVersion = useReleaseVersion(projectId);

  useEffect(() => {
    if (open) setMoveTargetId('none');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version) return;

    try {
      const result = await releaseVersion.mutateAsync({
        versionId: version.id,
        ...(moveTargetId !== 'none' ? { moveOpenIssuesToVersionId: moveTargetId } : {}),
      });
      toast({
        title: t('toast_released'),
        description: t('toast_released_moved', { count: result.movedIssueCount }),
        variant: 'success',
      });
      onOpenChange(false);
    } catch {
      toast({ title: t('error_generic'), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('release_title', { name: version?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('release_description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="release-move-target">{t('move_open_issues_label')}</Label>
              <Select value={moveTargetId} onValueChange={setMoveTargetId}>
                <SelectTrigger id="release-move-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('move_none')}</SelectItem>
                  {moveTargets.map((target) => (
                    <SelectItem key={target.id} value={target.id}>
                      {target.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tActions('cancel')}
            </Button>
            <Button type="submit" disabled={releaseVersion.isPending}>
              {releaseVersion.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="mr-2 h-4 w-4" />
              )}
              {t('release_submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
