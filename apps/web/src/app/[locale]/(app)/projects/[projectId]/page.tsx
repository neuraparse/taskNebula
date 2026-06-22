import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProjectViewsShell } from '@/components/issues/project-views-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pagesProjects');
  return {
    title: t('metaTitleDetail'),
  };
}

interface ProjectPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  return <ProjectViewsShell projectId={projectId} />;
}
