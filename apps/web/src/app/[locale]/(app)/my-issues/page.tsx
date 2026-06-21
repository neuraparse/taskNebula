import { Metadata } from 'next';
import { Suspense } from 'react';
import { MyIssuesClient } from './my-issues-client';
import { MyIssuesLoadingShell } from './my-issues-loading-shell';

export const metadata: Metadata = {
  title: 'My Issues | TaskNebula',
  description: 'View and manage your assigned issues',
};

// PPR opt-in stub — re-enable once Next ships PPR on stable.
// export const experimental_ppr = true;

export default function MyIssuesPage() {
  return (
    <Suspense fallback={<MyIssuesLoadingShell />}>
      <MyIssuesClient />
    </Suspense>
  );
}
