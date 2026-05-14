/**
 * POST /api/issues/:issueId/ai-estimate (task #10).
 *
 * Returns a suggested estimate (median + p25/p75 hours) drawn from similar
 * closed issues' actual hours, with a rationale string for the UI. Falls back
 * to per-project median when there aren't enough similar issues.
 *
 * This endpoint is read-only — it does NOT persist the estimate back onto the
 * issue. The UI calls PATCH /api/issues/:issueId with `{ estimateHours, estimateSource: 'ai_suggest' }`
 * once the user accepts the suggestion.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { suggestEstimateForIssue } from '@/lib/ai/estimate-issue';
import { assertIssueAccess } from '@/lib/time-tracking/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> },
) {
  const session = await auth();
  const { issueId } = await params;
  const access = await assertIssueAccess(session?.user?.id, issueId);
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  try {
    const result = await suggestEstimateForIssue({
      issueId,
      projectId: access.issue.projectId,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('ai-estimate failed', err);
    return NextResponse.json(
      { error: 'Failed to compute estimate' },
      { status: 500 },
    );
  }
}
