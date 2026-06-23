'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ExternalLink, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProjectSettingsContent } from './project-settings-content';

export interface ProjectSettingsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectSettingsDialog({
  projectId,
  open,
  onOpenChange,
}: ProjectSettingsDialogProps) {
  const t = useTranslations('projectsPages');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(94dvh,920px)] max-h-[calc(100dvh-1rem)] w-[min(calc(100vw-1rem),1180px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
        <DialogHeader className="border-border/80 bg-background/95 shrink-0 border-b px-4 py-4 pr-14 sm:px-6">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden="true"
                className="border-border bg-muted/40 text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
              >
                <Settings className="h-4 w-4" />
              </span>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="truncate text-base font-semibold">
                  {t('settings_dialog_title')}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground max-w-2xl text-xs leading-5">
                  {t('settings_dialog_description')}
                </DialogDescription>
              </div>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mr-1 hidden shrink-0 sm:inline-flex"
            >
              <Link href={`/projects/${projectId}/settings`} onClick={() => onOpenChange(false)}>
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{t('settings_open_full_page')}</span>
              </Link>
            </Button>
          </div>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <ProjectSettingsContent projectId={projectId} variant="dialog" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
