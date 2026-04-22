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
    <div className="container mx-auto max-w-6xl py-8">
      <WorkflowBuilder projectId={projectId} />
    </div>
  );
}
