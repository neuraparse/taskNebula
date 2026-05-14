import { Metadata } from 'next';
import { auth } from '@/auth';
import { notFound, redirect } from 'next/navigation';
import { InitiativesClient } from './initiatives-client';

export const metadata: Metadata = {
  title: 'Initiatives | TaskNebula',
  description: 'Plan multi-project workstreams and roll up progress',
};

export const dynamic = 'force-dynamic';

export default async function InitiativesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  // Feature flag — keep the page hidden when the workspace hasn't opted in.
  if (process.env.NEXT_PUBLIC_INITIATIVES_ENABLED !== 'true') {
    notFound();
  }

  return <InitiativesClient />;
}
