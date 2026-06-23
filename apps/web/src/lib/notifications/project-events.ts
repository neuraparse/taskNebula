import {
  db,
  users,
  organizations,
  organizationMembers,
  projectMembers,
  notifications,
  notificationPreferences,
} from '@tasknebula/db';
import { eq, and, inArray, ne } from 'drizzle-orm';

import { sendNotificationEmail } from '@/lib/notifications/email-notification';

/**
 * Project lifecycle notifications.
 *
 * Two events are supported:
 *   - project.created → org members (excluding creator)
 *   - project.archived → project members (excluding actor)
 *
 * Both write in-app rows into `notifications` and fire emails via
 * `sendProjectNotificationEmail`. Everything runs inside a try/catch so a
 * downstream failure (SMTP outage, bad template, etc.) can never take down
 * the originating API request — these are intentionally fire-and-forget.
 */

type ProjectEventInput = {
  project: {
    id: string;
    name: string;
    key?: string | null;
    description?: string | null;
    organizationId: string;
  };
  actorUserId: string;
};

/**
 * Fetches users whose preferences permit an in-app notification for a given
 * project event. Users with no prefs row fall back to the default (true).
 * Also filters by the master `enableInApp` toggle when prefs exist.
 */
async function filterInAppRecipients(
  userIds: string[],
  organizationId: string,
  field: 'inAppOnProjectCreated' | 'inAppOnProjectArchived'
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const prefs = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.organizationId, organizationId),
        inArray(notificationPreferences.userId, userIds)
      )
    );

  const prefByUser = new Map(prefs.map((p) => [p.userId, p]));

  return userIds.filter((userId) => {
    const p = prefByUser.get(userId);
    // No row → default to on (in-app defaults true).
    if (!p) return true;
    if (!p.enableInApp) return false;
    return p[field];
  });
}

/**
 * Resolve the recipient set for `project.created`: all organization members
 * except the creator. Only active memberships are considered.
 */
async function getOrgRecipients(
  organizationId: string,
  excludeUserId: string
): Promise<{ userId: string; email: string; name: string | null }[]> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, 'active'),
        ne(organizationMembers.userId, excludeUserId)
      )
    );

  return rows.filter((r) => r.email);
}

/**
 * Resolve the recipient set for `project.archived`: all members of the
 * project except the actor.
 */
async function getProjectRecipients(
  projectId: string,
  excludeUserId: string
): Promise<{ userId: string; email: string; name: string | null }[]> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(and(eq(projectMembers.projectId, projectId), ne(projectMembers.userId, excludeUserId)));

  return rows.filter((r) => r.email);
}

async function resolveActorAndOrg(actorUserId: string, organizationId: string) {
  const [actor] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, actorUserId))
    .limit(1);

  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return {
    actorName: actor?.name || actor?.email?.split('@')[0] || 'Someone',
    organization: org || { id: organizationId, name: 'Your organization' },
  };
}

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

async function sendProjectLifecycleEmails(params: {
  templateType: 'project_created' | 'project_archived';
  project: ProjectEventInput['project'];
  organization: { id: string; name: string };
  actorName: string;
  recipients: ReadonlyArray<{ userId: string; email: string; name: string | null }>;
  archivedAt?: string;
}): Promise<void> {
  const baseUrl = appUrl();
  const projectUrl = `${baseUrl}/projects/${params.project.id}`;
  const unsubscribeUrl = `${baseUrl}/settings/notifications`;

  await Promise.all(
    params.recipients.map((recipient) =>
      sendNotificationEmail({
        to: recipient.email,
        userId: recipient.userId,
        organizationId: params.organization.id,
        templateType: params.templateType,
        variables: {
          userName: recipient.name || recipient.email.split('@')[0] || 'there',
          recipientName: recipient.name || recipient.email.split('@')[0] || 'there',
          userEmail: recipient.email,
          projectName: params.project.name,
          projectKey: params.project.key || '',
          projectDescription: params.project.description || 'No description provided yet.',
          projectUrl,
          organizationName: params.organization.name,
          actorName: params.actorName,
          archivedAt: params.archivedAt || '',
          appUrl: baseUrl,
          unsubscribeUrl,
        },
      })
    )
  );
}

/**
 * Fire-and-forget entry point for `project.created`.
 * Safe to call without await — errors are swallowed after logging.
 */
export function notifyProjectCreated(input: ProjectEventInput): void {
  _notifyProjectCreated(input).catch((err) => {
    console.error('notifyProjectCreated failed:', err);
  });
}

async function _notifyProjectCreated(input: ProjectEventInput): Promise<void> {
  try {
    const recipients = await getOrgRecipients(input.project.organizationId, input.actorUserId);
    if (recipients.length === 0) return;

    const { actorName, organization } = await resolveActorAndOrg(
      input.actorUserId,
      input.project.organizationId
    );

    // In-app notifications — gated by prefs.
    const inAppRecipients = await filterInAppRecipients(
      recipients.map((r) => r.userId),
      input.project.organizationId,
      'inAppOnProjectCreated'
    );

    if (inAppRecipients.length > 0) {
      const message = `${actorName} created project ${input.project.name} in ${organization.name}.`;
      try {
        await db.insert(notifications).values(
          inAppRecipients.map((userId) => ({
            userId,
            type: 'project_created' as const,
            title: `New project: ${input.project.name}`,
            message,
            projectId: input.project.id,
            actorId: input.actorUserId,
          }))
        );
      } catch (err) {
        console.warn('Failed to insert project_created notifications:', err);
      }
    }

    // Email sends — each recipient is gated by preferences inside sendNotificationEmail().
    await sendProjectLifecycleEmails({
      project: input.project,
      organization,
      templateType: 'project_created',
      actorName,
      recipients,
    });
  } catch (err) {
    console.error('notifyProjectCreated inner error:', err);
  }
}

/**
 * Fire-and-forget entry point for `project.archived`.
 */
export function notifyProjectArchived(input: ProjectEventInput): void {
  _notifyProjectArchived(input).catch((err) => {
    console.error('notifyProjectArchived failed:', err);
  });
}

async function _notifyProjectArchived(input: ProjectEventInput): Promise<void> {
  try {
    const recipients = await getProjectRecipients(input.project.id, input.actorUserId);
    if (recipients.length === 0) return;

    const { actorName, organization } = await resolveActorAndOrg(
      input.actorUserId,
      input.project.organizationId
    );

    const archivedAt = new Date().toISOString().slice(0, 10);

    const inAppRecipients = await filterInAppRecipients(
      recipients.map((r) => r.userId),
      input.project.organizationId,
      'inAppOnProjectArchived'
    );

    if (inAppRecipients.length > 0) {
      const message = `${actorName} archived project ${input.project.name} on ${archivedAt}.`;
      try {
        await db.insert(notifications).values(
          inAppRecipients.map((userId) => ({
            userId,
            type: 'project_archived' as const,
            title: `Project archived: ${input.project.name}`,
            message,
            projectId: input.project.id,
            actorId: input.actorUserId,
          }))
        );
      } catch (err) {
        console.warn('Failed to insert project_archived notifications:', err);
      }
    }

    await sendProjectLifecycleEmails({
      project: input.project,
      organization,
      templateType: 'project_archived',
      actorName,
      archivedAt,
      recipients,
    });
  } catch (err) {
    console.error('notifyProjectArchived inner error:', err);
  }
}
