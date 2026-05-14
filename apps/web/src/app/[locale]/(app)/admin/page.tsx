import { redirect } from 'next/navigation';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { AdminDashboardClient } from './admin-dashboard-client';

export default async function AdminDashboardPage() {
  const isAdmin = await isSuperAdmin();

  if (!isAdmin) {
    redirect('/dashboard');
  }

  return <AdminDashboardClient />;
}

