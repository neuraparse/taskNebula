'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Globe, Lock, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProjectPublish } from '@/lib/projects/use-project-publish';
import { PublishProjectDialog } from './publish-project-dialog';

export interface ProjectPublishCardProps {
  projectId: string;
  projectName: string;
}

export function ProjectPublishCard({
  projectId,
  projectName,
}: ProjectPublishCardProps): React.ReactElement {
  const t = useTranslations('projectsPages');
  const { config, publicUrl } = useProjectPublish(projectId);
  const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);

  const openDialog = React.useCallback(() => setDialogOpen(true), []);

  return (
    <>
      <div className="surface-card border-border rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-md">
                {config.visibility === 'team-only' ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
              </div>
              <h3 className="text-foreground text-sm font-semibold">{t('public_access')}</h3>
              {config.enabled ? (
                <Badge variant="success">
                  <span className="bg-accent-emerald h-1.5 w-1.5 rounded-full" />
                  {t('live')}
                </Badge>
              ) : (
                <Badge variant="muted">{t('not_published')}</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {config.enabled
                ? t('published_as', {
                    layout: config.layout === 'board' ? t('layout_kanban_board') : t('layout_list'),
                    teamOnly: config.visibility === 'team-only' ? t('team_only_suffix') : '',
                  })
                : t('publish_card_hint')}
            </p>
          </div>

          {!config.enabled ? (
            <Button type="button" onClick={openDialog} size="sm">
              {t('publish_project')}
            </Button>
          ) : null}
        </div>

        {config.enabled ? (
          <div className="mt-4 space-y-3">
            <div className="border-border/60 bg-card/40 flex items-center gap-2 rounded-md border px-3 py-2">
              <Globe className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="text-muted-foreground flex-1 truncate font-mono text-xs">
                {publicUrl}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {t('open')}
                </a>
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={openDialog}>
                <SettingsIcon className="h-4 w-4" />
                {t('settings')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground ml-auto"
                onClick={openDialog}
              >
                {t('unpublish')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <PublishProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        projectName={projectName}
      />
    </>
  );
}

export default ProjectPublishCard;
