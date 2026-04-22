'use client';

import { use } from 'react';
import { WorkflowBuilder } from '@/components/workflows/workflow-builder';

export default function ProjectWorkflowsSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
      <WorkflowBuilder projectId={projectId} />
    </div>
  );
}
