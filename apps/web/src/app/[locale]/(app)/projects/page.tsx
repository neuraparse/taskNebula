import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ProjectsClient } from './projects-client';

export const metadata: Metadata = {
  title: 'Projects | TaskNebula',
  description: 'View and manage all your projects',
};

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  return <ProjectsClient />;
}
