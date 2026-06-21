import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { WorkspaceRequiredNotice } from '@/components/layout/workspace-required-notice';
import { IssueDetailView } from '@/components/issues/issue-detail-view';
import { userHasWorkspaceAccess } from '@/lib/auth/workspace-access';

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}) {
  const { issueId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/issues/${encodeURIComponent(issueId)}`);
  }

  if (!(await userHasWorkspaceAccess(session.user.id))) {
    return <WorkspaceRequiredNotice />;
  }

  return <IssueDetailView issueId={issueId} />;
}
