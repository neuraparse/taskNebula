import { auth } from '@/auth';
import { canReadProject } from '@/lib/auth/access-control';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import { notFound, redirect } from 'next/navigation';
import { ProjectLayoutClient } from './project-layout-client';
import type { ReactNode } from 'react';

interface ProjectLayoutProps {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const session = await auth();
  const { projectId } = await params;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/projects/${encodeURIComponent(projectId)}`);
  }

  const project = await resolveProjectByIdOrKey(projectId, session.user.id);

  if (!project || !(await canReadProject(session.user.id, project))) {
    notFound();
  }

  return (
    <ProjectLayoutClient
      projectId={projectId}
      initialProject={{
        id: project.id,
        key: project.key,
        name: project.name,
        organizationId: project.organizationId,
      }}
    >
      {children}
    </ProjectLayoutClient>
  );
}
