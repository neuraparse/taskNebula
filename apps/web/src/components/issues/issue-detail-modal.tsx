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
      <DialogContent className="max-w-6xl w-full h-[85vh] p-0 overflow-hidden gap-0">
        <VisuallyHidden>
          <DialogTitle>Issue Details</DialogTitle>
        </VisuallyHidden>
        <IssueDetailView issueId={issueId} />
      </DialogContent>
    </Dialog>
  );
}

