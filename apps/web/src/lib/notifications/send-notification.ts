import { db, users, sendIssueNotificationEmail } from '@tasknebula/db';
import { eq } from 'drizzle-orm';

/**
 * Send email notification for issue events.
 * Runs async (fire-and-forget) so it doesn't block API responses.
 * Silently fails if SMTP is not configured.
 */
export function notifyIssueEvent(params: {
  eventType: 'issue_assigned' | 'issue_mentioned' | 'issue_commented' | 'issue_status_changed' | 'issue_created';
  recipientUserId: string;
  actorUserId: string;
  organizationId: string;
  issueKey: string;
  issueTitle: string;
  projectName: string;
  extra?: Record<string, string>;
}) {
  // Fire-and-forget - don't await, don't block the API response
  _send(params).catch((err) => {
    console.error('Notification email error:', err.message);
  });
}

async function _send(params: {
  eventType: 'issue_assigned' | 'issue_mentioned' | 'issue_commented' | 'issue_status_changed' | 'issue_created';
  recipientUserId: string;
  actorUserId: string;
  organizationId: string;
  issueKey: string;
  issueTitle: string;
  projectName: string;
  extra?: Record<string, string>;
}) {
  // Don't notify yourself
  if (params.recipientUserId === params.actorUserId) return;

  // Get recipient email
  const [recipient] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, params.recipientUserId))
    .limit(1);

  if (!recipient?.email) return;

  // Get actor name
  const [actor] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, params.actorUserId))
    .limit(1);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const issueUrl = `${appUrl}/issues/${params.issueKey}`;

  await sendIssueNotificationEmail({
    to: recipient.email,
    userId: params.recipientUserId,
    organizationId: params.organizationId,
    eventType: params.eventType,
    issueKey: params.issueKey,
    issueTitle: params.issueTitle,
    issueUrl,
    actorName: actor?.name || 'Someone',
    projectName: params.projectName,
    additionalVariables: {
      recipientName: recipient.name || recipient.email.split('@')[0] || recipient.email,
      ...params.extra,
    },
  });
}
