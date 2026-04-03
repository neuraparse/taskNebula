'use client';

import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FilePlus2, FolderTree, Sparkles, WandSparkles } from 'lucide-react';

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
  scopeLabel,
  spaceName,
  className,
  onCreatePage,
}: DocsGettingStartedProps) {
  return (
    <div className={cn('rounded-[28px] border border-dashed bg-card/60 p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Docs</div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">
            {hasPages ? 'Open a note or create a new one' : 'Create your first note'}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{spaceName || 'Docs'}</Badge>
            <Badge variant="secondary">{scopeLabel}</Badge>
          </div>
        </div>
        <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Step icon={FilePlus2} title="Root note" />
        <Step icon={WandSparkles} title="Autosave" />
        <Step icon={FolderTree} title="Sub-notes" />
      </div>

      {canCreate ? (
        <Button className="mt-4" onClick={onCreatePage}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          New Page
        </Button>
      ) : (
        <div className="mt-4 text-sm text-muted-foreground">Read-only space</div>
      )}
    </div>
  );
}

function Step({
  icon: Icon,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-2 text-sm">
      <div className="rounded-lg bg-muted p-1.5 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="font-medium">{title}</div>
    </div>
  );
}
