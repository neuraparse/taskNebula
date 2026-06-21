import { Metadata } from 'next';
import { auth } from '@/auth';
import { notFound, redirect } from 'next/navigation';
import { WorkspaceRequiredNotice } from '@/components/layout/workspace-required-notice';
import { resolveInitiativeAccess } from '@/lib/initiatives/access';
import { InitiativeDetailClient } from './initiative-detail-client';

export const metadata: Metadata = {
  title: 'Initiative | TaskNebula',
};

export const dynamic = 'force-dynamic';

export default async function InitiativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');
  const { id } = await params;
  const access = await resolveInitiativeAccess(session.user.id, id);
  if (!access.initiative) {
    notFound();
  }
  if (!access.canRead) {
    return <WorkspaceRequiredNotice />;
  }

  return <InitiativeDetailClient initiativeId={id} />;
}
