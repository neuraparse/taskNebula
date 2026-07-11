import { redirect } from 'next/navigation';

/**
 * Compatibility entrypoint for older issue-list links and bookmarks.
 * The canonical list route is /my-issues; issue detail pages remain under
 * /issues/[issueId].
 */
export default function IssuesIndexPage() {
  redirect('/my-issues');
}
