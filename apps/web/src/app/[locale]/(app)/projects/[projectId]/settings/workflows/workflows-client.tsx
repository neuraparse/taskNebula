'use client';

import { WorkflowBuilder } from '@/components/workflows/workflow-builder';

export function ProjectWorkflowsClient({ projectId }: { projectId: string }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
      <WorkflowBuilder projectId={projectId} />
    </div>
  );
}
