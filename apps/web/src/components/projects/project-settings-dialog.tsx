'use client';

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[900px] w-[min(96vw,1100px)] max-w-none flex-col overflow-hidden p-0 sm:rounded-md">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="text-base font-semibold">Project settings</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure permissions, workflows, custom fields, and integrations.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <ProjectSettingsContent projectId={projectId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
