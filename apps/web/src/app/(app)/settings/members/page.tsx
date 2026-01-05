import { Suspense } from 'react';
import { MembersPageClient } from './members-page-client';

export default function MembersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MembersPageClient />
    </Suspense>
  );
}

