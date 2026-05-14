import { Metadata } from 'next';
import { auth } from '@/auth';
import { notFound, redirect } from 'next/navigation';
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

  if (process.env.NEXT_PUBLIC_INITIATIVES_ENABLED !== 'true') {
    notFound();
  }

  const { id } = await params;
  return <InitiativeDetailClient initiativeId={id} />;
}
