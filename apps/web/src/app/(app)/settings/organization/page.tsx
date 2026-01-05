import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { OrganizationSettingsClient } from './organization-settings-client';

export default async function OrganizationSettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return <OrganizationSettingsClient />;
}

