import { IssueDetailView } from '@/components/issues/issue-detail-view';

export default async function IssueDetailPage({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  return <IssueDetailView issueId={issueId} />;
}

