import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { InitiativesClient } from './initiatives-client';

export const metadata: Metadata = {
  title: 'Initiatives | TaskNebula',
  description: 'Plan multi-project workstreams and roll up progress',
};

export const dynamic = 'force-dynamic';

export default async function InitiativesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');
  return <InitiativesClient />;
}
