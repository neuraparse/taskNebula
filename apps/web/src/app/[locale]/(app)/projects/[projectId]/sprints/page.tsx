'use client';

import { use } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  Plus,
  Calendar,
  Target,
  CheckCircle2,
  Trash2,
  Lock,
  Timer,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSprints, useDeleteSprint } from '@/lib/hooks/use-sprints';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import { CreateSprintModal } from '@/components/sprints/create-sprint-modal';
import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PageFrame } from '@/components/ui/page-frame';
import { PageHeader } from '@/components/ui/page-header';

export default function SprintsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const t = useTranslations('pagesProjects');
  const tActions = useTranslations('actions');
  const formatter = useFormatter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: sprints, isLoading } = useSprints(projectId);
  const deleteSprint = useDeleteSprint();
  const { permissions, isLoading: permissionsLoading } = useProjectPermissions(projectId);

  const handleDeleteSprint = async (sprintId: string) => {
    if (!confirm(t('confirmDeleteSprint'))) return;
    try {
      await deleteSprint.mutateAsync(sprintId);
    } catch (error) {
      console.error('Error deleting sprint:', error);
      alert(t('deleteSprintFailed'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20 hover:bg-accent-emerald/20 rounded-sm">
            <span className="status-dot status-live mr-1.5" />
            {t('statusActive')}
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-accent-blue/10 text-accent-blue border-accent-blue/20 rounded-sm">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {t('statusCompleted')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground rounded-sm">
            <Calendar className="mr-1 h-3 w-3" />
            {t('statusPlanned')}
          </Badge>
        );
    }
  };

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t('loadingSprints')}</div>
      </div>
    );
  }

  if (
    !permissions.canBrowseProject &&
    !permissions.isSuperAdmin &&
    !permissions.isOrgOwner &&
    !permissions.isOrgAdmin
  ) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Lock className="text-muted-foreground h-12 w-12" />
        <div className="text-lg font-medium">{t('accessDenied')}</div>
        <div className="text-muted-foreground">{t('noProjectPermission')}</div>
        <Button asChild variant="outline">
          <Link href="/projects">{t('backToProjects')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageFrame className="animate-fade-in" contentClassName="space-y-5">
        <PageHeader
          title={t('sprintsTitle')}
          description={t('sprintsSubtitle')}
          actions={
            permissions.canManageSprints ? (
              <Button
                size="sm"
                className="h-8 w-full gap-1.5 text-xs sm:w-auto"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('newSprint')}
              </Button>
            ) : null
          }
        />

        {/* Sprint List */}
        {sprints && sprints.length > 0 ? (
          <div className="stagger space-y-3">
            {sprints.map((sprint) => {
              const startDate = new Date(sprint.startDate);
              const endDate = new Date(sprint.endDate);
              const now = Date.now();
              const totalDays = Math.ceil(
                (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
              );
              const daysLeft = Math.max(
                0,
                Math.ceil((endDate.getTime() - now) / (1000 * 60 * 60 * 24))
              );
              const progress =
                sprint.status === 'active'
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        ((now - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) *
                          100
                      )
                    )
                  : sprint.status === 'completed'
                    ? 100
                    : 0;

              return (
                <div
                  key={sprint.id}
                  className={cn(
                    'surface-card surface-card-hover ease-snap group rounded-lg transition-[border-color,background-color] duration-150',
                    sprint.status === 'active' && 'border-accent-emerald/20'
                  )}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Left */}
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2.5">
                          <Link
                            href={`/projects/${projectId}/sprints/${sprint.id}`}
                            className="hover:text-primary text-base font-semibold transition-colors"
                          >
                            {sprint.name}
                          </Link>
                          {getStatusBadge(sprint.status)}
                        </div>

                        {sprint.goal && (
                          <p className="text-muted-foreground mb-3 flex items-start gap-1.5 text-sm">
                            <Target className="text-muted-foreground/50 mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {sprint.goal}
                          </p>
                        )}

                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatter.dateTime(startDate, {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            -{' '}
                            {formatter.dateTime(endDate, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span>{t('daysCount', { count: totalDays })}</span>
                          <span>{t('issuesCount', { count: sprint.issueCount || 0 })}</span>
                          {sprint.status === 'active' && daysLeft > 0 && (
                            <span
                              className={cn(
                                'font-medium',
                                daysLeft <= 3 ? 'text-accent-amber' : 'text-accent-emerald'
                              )}
                            >
                              {t('daysRemaining', { count: daysLeft })}
                            </span>
                          )}
                        </div>

                        {sprint.status === 'active' && (
                          <div className="mt-3 flex items-center gap-3">
                            <div className="bg-primary/10 h-1.5 flex-1 overflow-hidden rounded-sm">
                              <div
                                className="bg-primary ease-snap h-full rounded-sm transition-[width] duration-150"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground w-8 text-[11px] tabular-nums">
                              {Math.round(progress)}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right actions */}
                      <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                          <Link href={`/projects/${projectId}/sprints/${sprint.id}`}>
                            {t('view')}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                        {permissions.canDeleteSprint && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-8 w-8 opacity-100 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            aria-label={tActions('delete')}
                            onClick={() => handleDeleteSprint(sprint.id)}
                            disabled={deleteSprint.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="animate-fade-up border-border mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
            <Timer className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              {permissions.canManageSprints ? t('sprintsEmptyManage') : t('sprintsEmptyReadonly')}
            </p>
            {permissions.canManageSprints && (
              <Button size="sm" variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('createSprint')}
              </Button>
            )}
          </div>
        )}
      </PageFrame>

      <CreateSprintModal
        projectId={projectId}
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </>
  );
}
