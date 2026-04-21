'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { IssueDetailView } from './issue-detail-view';

// Local VisuallyHidden replacement - renders children in sr-only span
const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span className="sr-only">{children}</span>
);

interface IssueDetailModalProps {
  issueId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IssueDetailModal({ issueId, open, onOpenChange }: IssueDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !transform flex h-[88vh] max-h-[920px] w-[92vw] max-w-6xl flex-col gap-0 overflow-hidden rounded-lg border-border p-0 shadow-lg animate-pop-in">
        <VisuallyHidden>
          <DialogTitle>Issue Details</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogDescription>
            View and update the selected issue, including fields, comments, activity, and linked records.
          </DialogDescription>
        </VisuallyHidden>
        <IssueDetailView issueId={issueId} />
      </DialogContent>
    </Dialog>
  );
}
