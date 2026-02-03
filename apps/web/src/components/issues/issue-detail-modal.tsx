'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { IssueDetailView } from './issue-detail-view';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface IssueDetailModalProps {
  issueId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IssueDetailModal({ issueId, open, onOpenChange }: IssueDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !transform max-w-5xl w-[90vw] h-[85vh] max-h-[850px] p-0 overflow-hidden gap-0 flex flex-col rounded-xl border-border/50 shadow-2xl">
        <VisuallyHidden>
          <DialogTitle>Issue Details</DialogTitle>
        </VisuallyHidden>
        <IssueDetailView issueId={issueId} />
      </DialogContent>
    </Dialog>
  );
}
