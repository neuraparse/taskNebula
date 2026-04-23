'use client';

import * as React from 'react';
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
  const { config, publicUrl } = useProjectPublish(projectId);
  const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);

  const openDialog = React.useCallback(() => setDialogOpen(true), []);

  return (
    <>
      <div className="surface-card rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                {config.visibility === 'team-only' ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
              </div>
              <h3 className="text-sm font-semibold text-foreground">Public access</h3>
              {config.enabled ? (
                <Badge variant="success">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald" />
                  Live
                </Badge>
              ) : (
                <Badge variant="muted">Not published</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {config.enabled
                ? `Published as a read-only ${config.layout === 'board' ? 'Kanban board' : 'list'}${
                    config.visibility === 'team-only' ? ' (team only)' : ''
                  }.`
                : 'Publish this project as a read-only Kanban or list that anyone with the link can view.'}
            </p>
          </div>

          {!config.enabled ? (
            <Button type="button" onClick={openDialog} size="sm">
              Publish project
            </Button>
          ) : null}
        </div>

        {config.enabled ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 py-2">
              <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
                {publicUrl}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={openDialog}>
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={openDialog}
              >
                Unpublish
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
