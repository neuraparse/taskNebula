import { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkspaceRequiredNotice } from '@/components/layout/workspace-required-notice';
import { currentUserHasWorkspaceAccess } from '@/lib/auth/workspace-access';
import { DashboardClient } from './dashboard-client';
import { DashboardLoadingShell } from './dashboard-loading-shell';

export const metadata: Metadata = {
  title: 'Dashboard | TaskNebula',
  description: 'Your project management dashboard',
};

// PPR opt-in stub — re-enable once Next ships PPR on stable.
// The Suspense + skeleton shell below already gives an instant-paint
// experience; flipping the flag will additionally let the shell be
// statically prerendered.
// export const experimental_ppr = true;

export default async function DashboardPage() {
  const hasWorkspaceAccess = await currentUserHasWorkspaceAccess();

  if (!hasWorkspaceAccess) {
    return <WorkspaceRequiredNotice />;
  }

  return (
    <Suspense fallback={<DashboardLoadingShell />}>
      <DashboardClient />
    </Suspense>
  );
}
