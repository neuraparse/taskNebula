import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
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
  return <InitiativeDetailClient initiativeId={id} />;
}
