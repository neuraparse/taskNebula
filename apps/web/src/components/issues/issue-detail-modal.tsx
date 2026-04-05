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
      <DialogContent className="!left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !transform flex h-[88vh] max-h-[920px] w-[92vw] max-w-6xl flex-col gap-0 overflow-hidden rounded-none border-border/60 p-0 shadow-[0_30px_90px_-52px_rgba(0,0,0,0.75)]">
        <VisuallyHidden>
          <DialogTitle>Issue Details</DialogTitle>
        </VisuallyHidden>
        <IssueDetailView issueId={issueId} />
      </DialogContent>
    </Dialog>
  );
}
