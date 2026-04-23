import {
  db,
  users,
  projectMembers,
  notifications,
  notificationPreferences,
  sendSprintNotificationEmail,
  eq,
  and,
  inArray,
} from '@tasknebula/db';

/**
 * Sprint lifecycle notification dispatcher.
 *
 * Fans out one email + one in-app notification per project member when a sprint
 * transitions planned→active or active→completed. Every call is fire-and-forget
 * and swallows its own errors — the API response must never wait on SMTP or
 * notification writes.
 *
 * Preference gating:
 *   - Email: delegated to sendEmail → shouldSendEmail (email master switch,
 *     DND, emailOnSprintStarted / emailOnSprintCompleted).
 *   - In-app: checked here against inAppOnSprintStarted / inAppOnSprintCompleted
 *     and the global enableInApp master switch. Users without a prefs row get
 *     defaults (in-app ON).
 *
 * The actor (the user who started/completed the sprint) is excluded from
 * notifications — they already know.
 */

export type SprintEventType = 'sprint.started' | 'sprint.completed';

interface SprintForNotification {
  id: string;
  name: string;
  goal?: string | null;
  startDate: Date | string;
  endDate: Date | string;
}

interface ProjectForNotification {
  id: string;
  key: string;
  name: string;
  organizationId: string;
}

interface SprintStats {
  issueCount: number;
  completedCount: number;
  carriedOverCount: number;
}

export function notifySprintEvent(params: {
  eventType: SprintEventType;
  sprint: SprintForNotification;
  project: ProjectForNotification;
  actorUserId: string;
  stats?: SprintStats;
}) {
  // Fire-and-forget — catch so an unhandled rejection never crashes the server.
  _notifySprint(params).catch((err) => {
    console.error('Sprint notification error:', err);
  });
}

async function _notifySprint(params: {
  eventType: SprintEventType;
  sprint: SprintForNotification;
  project: ProjectForNotification;
  actorUserId: string;
  stats?: SprintStats;
}) {
  const { eventType, sprint, project, actorUserId, stats } = params;

  // 1. Gather project members (exclude the actor).
  const members = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, project.id));

  const recipientUserIds = members
    .map((m) => m.userId)
    .filter((uid) => uid && uid !== actorUserId);

  if (recipientUserIds.length === 0) return;

  // 2. Load recipient users (need email for SMTP, name for greeting).
  //    Dedupe defensively in case a user is listed twice.
  const uniqueUserIds = Array.from(new Set(recipientUserIds));
  const userRows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(inArray(users.id, uniqueUserIds));

  if (userRows.length === 0) return;

  // 3. Load notification preferences for all recipients (scoped to this org).
  //    Missing row = defaults (in-app ON).
  const prefsRows = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.organizationId, project.organizationId),
        inArray(notificationPreferences.userId, uniqueUserIds),
      ),
    );

  const prefsByUserId = new Map<string, typeof prefsRows[number]>();
  for (const row of prefsRows) prefsByUserId.set(row.userId, row);

  // 4. Get actor name for template.
  const [actor] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, actorUserId))
    .limit(1);

  // 5. Build notification rows + email recipients, gated by prefs.
  const notificationType = eventType === 'sprint.started' ? 'sprint_started' : 'sprint_completed';
  const title =
    eventType === 'sprint.started'
      ? `Sprint ${sprint.name} started`
      : `Sprint ${sprint.name} completed`;
  const message =
    eventType === 'sprint.started'
      ? `${actor?.name || 'A teammate'} started "${sprint.name}" in ${project.name}.`
      : `${actor?.name || 'A teammate'} completed "${sprint.name}" in ${project.name}.`;

  const inAppRows: Array<typeof notifications.$inferInsert> = [];
  const emailRecipients: Array<{ userId: string; email: string; name?: string | null }> = [];

  for (const user of userRows) {
    if (!user.email) continue;
    const prefs = prefsByUserId.get(user.id);

    // In-app gating: master switch + per-event toggle. Default ON when no row.
    const inAppEnabled = prefs ? prefs.enableInApp : true;
    const perEventInApp = prefs
      ? eventType === 'sprint.started'
        ? prefs.inAppOnSprintStarted
        : prefs.inAppOnSprintCompleted
      : true;

    if (inAppEnabled && perEventInApp) {
      inAppRows.push({
        userId: user.id,
        type: notificationType,
        title,
        message,
        projectId: project.id,
        actorId: actorUserId,
      });
    }

    // Email gating is handled inside sendEmail (shouldSendEmail). We still
    // pass every user; sendEmail returns 'skipped-by-preferences' when off.
    emailRecipients.push({ userId: user.id, email: user.email, name: user.name });
  }

  // 6. Insert all in-app notifications in one go. Failures are logged but
  //    must not prevent email from being sent.
  if (inAppRows.length > 0) {
    try {
      await db.insert(notifications).values(inAppRows);
    } catch (err) {
      console.error('Failed to insert sprint in-app notifications:', err);
    }
  }

  // 7. Send emails. Errors are swallowed inside sendSprintNotificationEmail.
  if (emailRecipients.length > 0) {
    try {
      await sendSprintNotificationEmail({
        sprint,
        project,
        eventType,
        recipients: emailRecipients,
        actorName: actor?.name || 'A teammate',
        stats,
      });
    } catch (err) {
      console.error('Failed to send sprint emails:', err);
    }
  }
}

