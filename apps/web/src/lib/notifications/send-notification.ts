import { db, notifications, notificationPreferences, organizations, users } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';

import { sendNotificationEmail } from '@/lib/notifications/email-notification';

type IssueNotificationEvent =
  | 'issue_assigned'
  | 'issue_mentioned'
  | 'issue_commented'
  | 'issue_status_changed'
  | 'issue_created';

export type IssueNotificationParams = {
  eventType: IssueNotificationEvent;
  recipientUserId: string;
  actorUserId: string;
  organizationId: string;
  issueId: string;
  projectId: string;
  issueKey: string;
  issueTitle: string;
  projectName: string;
  extra?: Record<string, string>;
};

const IN_APP_PREF_FIELD_BY_EVENT = {
  issue_assigned: 'inAppOnAssigned',
  issue_mentioned: 'inAppOnMentioned',
  issue_commented: 'inAppOnCommented',
  issue_status_changed: 'inAppOnStatusChanged',
  issue_created: 'inAppOnIssueCreated',
} as const;

const NOTIFICATION_TYPE_BY_EVENT = {
  issue_assigned: 'assigned',
  issue_mentioned: 'mention',
  issue_commented: 'comment',
  issue_status_changed: 'status_changed',
  issue_created: 'issue_created',
} as const;

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

function fallbackName(email?: string | null) {
  return email?.split('@')[0] || 'Someone';
}

async function shouldCreateInAppNotification(params: IssueNotificationParams): Promise<boolean> {
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, params.recipientUserId),
        eq(notificationPreferences.organizationId, params.organizationId)
      )
    )
    .limit(1);

  if (!prefs) return true;
  if (!prefs.enableInApp) return false;

  const field = IN_APP_PREF_FIELD_BY_EVENT[params.eventType];
  return Boolean(prefs[field]);
}

function issueNotificationCopy(params: IssueNotificationParams, actorName: string) {
  switch (params.eventType) {
    case 'issue_assigned':
      return {
        title: `Assigned to you: ${params.issueKey}`,
        message: `${actorName} assigned ${params.issueKey} to you.`,
      };
    case 'issue_mentioned':
      return {
        title: `Mentioned you: ${params.issueKey}`,
        message: `${actorName} mentioned you in ${params.issueKey}.`,
      };
    case 'issue_commented':
      return {
        title: `New comment: ${params.issueKey}`,
        message: `${actorName} commented on ${params.issueKey}.`,
      };
    case 'issue_status_changed': {
      const newStatus = params.extra?.newStatus;
      return {
        title: `Status changed: ${params.issueKey}`,
        message: newStatus
          ? `${actorName} moved ${params.issueKey} to ${newStatus}.`
          : `${actorName} updated the status for ${params.issueKey}.`,
      };
    }
    case 'issue_created':
      return {
        title: `New issue: ${params.issueKey}`,
        message: `${actorName} created ${params.issueKey}.`,
      };
  }
}

/**
 * Fire-and-forget entry point for issue/task notifications.
 * The originating API response must not fail because SMTP or notification
 * storage is temporarily unavailable.
 */
export function notifyIssueEvent(params: IssueNotificationParams): void {
  void notifyIssueEventNow(params).catch((err) => {
    console.error('Issue notification error:', err);
  });
}

export async function notifyIssueEventNow(params: IssueNotificationParams): Promise<void> {
  if (params.recipientUserId === params.actorUserId) return;

  const [recipient] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, params.recipientUserId))
    .limit(1);

  if (!recipient) return;

  const [actor] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, params.actorUserId))
    .limit(1);

  const [organization] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, params.organizationId))
    .limit(1);

  const actorName = actor?.name || fallbackName(actor?.email);
  const organizationName = organization?.name || 'Your organization';

  try {
    if (await shouldCreateInAppNotification(params)) {
      const copy = issueNotificationCopy(params, actorName);
      await db.insert(notifications).values({
        userId: params.recipientUserId,
        type: NOTIFICATION_TYPE_BY_EVENT[params.eventType],
        title: copy.title,
        message: copy.message,
        issueId: params.issueId,
        projectId: params.projectId,
        actorId: params.actorUserId,
        actorType: 'user',
      });
    }
  } catch (error) {
    console.warn('Failed to insert issue notification:', error);
  }

  if (!recipient.email) return;

  const baseUrl = appUrl();
  await sendNotificationEmail({
    to: recipient.email,
    userId: params.recipientUserId,
    organizationId: params.organizationId,
    templateType: params.eventType,
    variables: {
      userName: recipient.name || fallbackName(recipient.email),
      recipientName: recipient.name || fallbackName(recipient.email),
      userEmail: recipient.email,
      issueKey: params.issueKey,
      issueTitle: params.issueTitle,
      issueUrl: `${baseUrl}/issues/${params.issueId}`,
      actorName,
      projectName: params.projectName,
      organizationName,
      appUrl: baseUrl,
      unsubscribeUrl: `${baseUrl}/settings/notifications`,
      ...params.extra,
    },
  });
}
