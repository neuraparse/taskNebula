'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FilePlus2, NotebookText } from 'lucide-react';

interface DocsGettingStartedProps {
  canCreate: boolean;
  hasPages: boolean;
  scopeLabel: string;
  spaceName?: string | null;
  className?: string;
  onCreatePage?: () => void;
}

export function DocsGettingStarted({
  canCreate,
  hasPages,
  className,
  onCreatePage,
}: DocsGettingStartedProps) {
  return (
    <div className={cn('animate-fade-in flex flex-col items-center gap-4 py-12 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
        <NotebookText className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {hasPages ? 'Select a page to get started' : 'No pages yet'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {hasPages
            ? 'Pick a note from the left panel or create a new one.'
            : 'Create your first note to start building your knowledge base.'}
        </p>
      </div>
      {canCreate && (
        <Button size="sm" onClick={onCreatePage}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          New Page
        </Button>
      )}
      {!canCreate && (
        <p className="text-xs text-muted-foreground">Read-only space</p>
      )}
    </div>
  );
}
