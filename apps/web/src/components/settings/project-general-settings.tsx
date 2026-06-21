'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { isApiPermissionError } from '@/lib/client-api-errors';
import { useDeleteProject, useProject, useUpdateProject } from '@/lib/hooks/use-projects';
import { AlertTriangle } from 'lucide-react';

interface ProjectGeneralSettingsProps {
  projectId: string;
}

const PROJECT_STATUSES: ReadonlyArray<{
  value: string;
  i18nKey: 'status_active' | 'status_on_hold' | 'status_archived';
}> = [
  { value: 'active', i18nKey: 'status_active' },
  { value: 'on_hold', i18nKey: 'status_on_hold' },
  { value: 'archived', i18nKey: 'status_archived' },
];

const PROJECT_VISIBILITY: ReadonlyArray<{
  value: string;
  i18nKey: 'visibility_private' | 'visibility_internal' | 'visibility_public';
}> = [
  { value: 'private', i18nKey: 'visibility_private' },
  { value: 'internal', i18nKey: 'visibility_internal' },
  { value: 'public', i18nKey: 'visibility_public' },
];

export function ProjectGeneralSettings({ projectId }: ProjectGeneralSettingsProps) {
  const t = useTranslations('settingsProject');
  const tSettings = useTranslations('settings');
  const router = useRouter();
  const { toast } = useToast();
  const { data: project, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const getErrorDescription = (error: unknown, fallback: string) =>
    isApiPermissionError(error) ? tSettings('error_no_permission') : fallback;
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
        title: t('toast_updated_title'),
        description: t('toast_updated_description'),
      });
    } catch (error) {
      toast({
        title: t('toast_save_failed_title'),
        description: getErrorDescription(error, t('toast_save_failed_description')),
        variant: 'destructive',
      });
    }
  }

  async function handleDelete() {
    const shouldDelete = window.confirm(t('delete_confirm'));

    if (!shouldDelete) {
      return;
    }

    try {
      await deleteProject.mutateAsync(projectId);
      toast({
        title: t('toast_deleted_title'),
        description: t('toast_deleted_description'),
      });
      router.push('/projects');
      router.refresh();
    } catch (error) {
      toast({
        title: t('toast_delete_failed_title'),
        description: getErrorDescription(error, t('toast_delete_failed_description')),
        variant: 'destructive',
      });
    }
  }

  if (isLoading || !project) {
    return <div className="text-muted-foreground p-4 text-sm">{t('loading')}</div>;
  }

  const hasChanges =
    formData.name !== (project.name || '') ||
    formData.key !== (project.key || '') ||
    formData.description !== (project.description || '') ||
    formData.status !== project.status ||
    formData.visibility !== ((project as { visibility?: string }).visibility || 'internal');

  return (
    <div className="animate-fade-up stagger space-y-8">
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">{t('kicker')}</span>
          <h2 className="text-lg font-semibold tracking-tight">{t('general_title')}</h2>
          <p className="text-muted-foreground max-w-prose text-sm">{t('general_description')}</p>
        </div>
        <div className="surface-card space-y-6 rounded-lg p-6">
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
            <Label htmlFor="project-name" className="text-sm font-medium">
              {t('name_label')}
            </Label>
            <Input
              id="project-name"
              value={formData.name}
              onChange={(event) =>
                setFormData((current) => ({ ...current, name: event.target.value }))
              }
              placeholder={t('name_placeholder')}
              className="ease-snap transition-all duration-150"
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
            <div className="space-y-1">
              <Label htmlFor="project-key" className="text-sm font-medium">
                {t('key_label')}
              </Label>
              <p className="text-muted-foreground text-xs">{t('key_hint')}</p>
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
              className="ease-snap transition-all duration-150"
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
            <Label htmlFor="project-description" className="text-sm font-medium">
              {t('description_label')}
            </Label>
            <Textarea
              id="project-description"
              rows={4}
              value={formData.description}
              onChange={(event) =>
                setFormData((current) => ({ ...current, description: event.target.value }))
              }
              placeholder={t('description_placeholder')}
              className="ease-snap transition-all duration-150"
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
            <Label className="text-sm font-medium">{t('status_label')}</Label>
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
                    {t(status.i18nKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
            <Label className="text-sm font-medium">{t('visibility_label')}</Label>
            <Select
              value={formData.visibility}
              onValueChange={(value) =>
                setFormData((current) => ({ ...current, visibility: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_VISIBILITY.map((visibility) => (
                  <SelectItem key={visibility.value} value={visibility.value}>
                    {t(visibility.i18nKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-border flex items-center justify-between border-t pt-4">
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <span className="chip">
                {t('issue_count', { count: (project as { issueCount?: number }).issueCount || 0 })}
              </span>
              <span className="chip">
                {t('sprint_count', {
                  count: (project as { sprintCount?: number }).sprintCount || 0,
                })}
              </span>
              {(project as { activeSprint?: { name?: string } | null }).activeSprint?.name ? (
                <span className="chip-accent">
                  {t('active_sprint', {
                    name: (project as { activeSprint: { name: string } }).activeSprint.name,
                  })}
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
                {t('reset')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !hasChanges ||
                  updateProject.isPending ||
                  !formData.name.trim() ||
                  !formData.key.trim()
                }
              >
                {updateProject.isPending ? t('saving') : t('save_changes')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="animate-fade-up space-y-4">
        <div className="space-y-1">
          <span className="kicker text-destructive">{t('danger_zone')}</span>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <AlertTriangle className="text-destructive h-4 w-4" />
            {t('delete_project')}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">{t('delete_blocked_hint')}</p>
        </div>
        <div className="panel-danger animate-alert-in flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm">{t('delete_irreversible')}</p>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteProject.isPending}>
            {deleteProject.isPending ? t('deleting') : t('delete_project')}
          </Button>
        </div>
      </section>
    </div>
  );
}
