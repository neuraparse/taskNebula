'use client';

import { use } from 'react';
import { Layers } from 'lucide-react';
import { ModulesGrid } from '@/components/modules/modules-grid';

export default function ModulesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <div className="h-full overflow-y-auto animate-fade-in">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
              <p className="text-sm text-muted-foreground">
                Group related work into feature areas and mini-projects.
              </p>
            </div>
          </div>
        </div>

        <ModulesGrid projectId={projectId} />
      </div>
    </div>
  );
}
