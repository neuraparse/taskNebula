'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
      <DialogContent className="flex h-[min(92dvh,900px)] w-[min(calc(100vw-1rem),1120px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-md">
        <DialogHeader className="border-border shrink-0 border-b px-4 py-4 pr-12 sm:px-6">
          <DialogTitle className="text-base font-semibold">
            {t('settings_dialog_title')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {t('settings_dialog_description')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <ProjectSettingsContent projectId={projectId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
