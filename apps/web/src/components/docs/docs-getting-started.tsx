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
    <div className={cn('animate-fade-up flex flex-col items-center gap-4 py-16 text-center', className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-muted-foreground">
        <NotebookText className="h-5 w-5" />
      </div>
      <p className="text-sm text-muted-foreground">
        {hasPages ? 'Select a page from the sidebar to get started.' : 'No pages yet in this space.'}
      </p>
      {canCreate ? (
        <Button size="sm" onClick={onCreatePage}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          Create page
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Read-only space</p>
      )}
    </div>
  );
}
