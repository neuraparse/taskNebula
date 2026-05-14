'use client';

import { use } from 'react';
import { ProjectViewsShell } from '@/components/issues/project-views-shell';

export default function ProjectViewsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);

  return <ProjectViewsShell projectId={projectId} />;
}
