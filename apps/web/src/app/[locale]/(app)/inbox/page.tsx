import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { WorkspaceRequiredNotice } from '@/components/layout/workspace-required-notice';
import { userHasWorkspaceAccess } from '@/lib/auth/workspace-access';
import { InboxPageClient } from './inbox-client';

export const metadata: Metadata = {
  title: 'Inbox | TaskNebula',
  description: 'Unified Smart Inbox: mentions, agent runs, webhooks, and system events.',
};

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  if (!(await userHasWorkspaceAccess(session.user.id))) {
    return <WorkspaceRequiredNotice />;
  }

  return <InboxPageClient />;
}
