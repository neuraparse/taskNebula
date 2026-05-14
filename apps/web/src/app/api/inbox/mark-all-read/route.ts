/**
 * POST /api/inbox/mark-all-read — bulk mark-read with optional filter.
 *
 * Query params mirror the inbox filter chips (actor_type, notification_type,
 * project, since, until). When omitted, all unread items for the user are
 * marked read. Snoozed items are still cleared so the user has a fresh
 * starting point after running this action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  notifications,
  eq,
  and,
  gte,
  lte,
  inArray,
} from '@tasknebula/db';

export const dynamic = 'force-dynamic';

type DbNotificationType =
  | 'mention'
  | 'comment'
  | 'assigned'
  | 'status_changed'
  | 'issue_created'
  | 'issue_updated'
  | 'issue_linked'
  | 'sprint_started'
  | 'sprint_completed'
  | 'ai_draft_failed'
  | 'agent_run_failed'
  | 'project_created'
  | 'project_archived';

const TYPE_GROUPS: Record<string, DbNotificationType[]> = {
  mention: ['mention'],
  assignment: ['assigned'],
  due: ['sprint_started', 'sprint_completed'],
  status: ['status_changed', 'issue_updated'],
  comment: ['comment'],
  reaction: [],
};

const VALID_ACTOR_TYPES = ['user', 'agent', 'webhook', 'system'] as const;
type InboxActorType = (typeof VALID_ACTOR_TYPES)[number];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const actorTypeParam = searchParams.get('actor_type');
    const notificationTypeParam = searchParams.get('notification_type');
    const projectId = searchParams.get('project');
    const sinceParam = searchParams.get('since');
    const untilParam = searchParams.get('until');

    const conditions = [eq(notifications.userId, userId), eq(notifications.isRead, false)];

    if (actorTypeParam && (VALID_ACTOR_TYPES as readonly string[]).includes(actorTypeParam)) {
      conditions.push(eq(notifications.actorType, actorTypeParam as InboxActorType));
    }

    if (notificationTypeParam && TYPE_GROUPS[notificationTypeParam]) {
      const enumValues = TYPE_GROUPS[notificationTypeParam];
      if (enumValues.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }
      conditions.push(inArray(notifications.type, enumValues));
    }

    if (projectId) {
      conditions.push(eq(notifications.projectId, projectId));
    }

    if (sinceParam) {
      const since = new Date(sinceParam);
      if (!Number.isNaN(since.getTime())) {
        conditions.push(gte(notifications.createdAt, since));
      }
    }
    if (untilParam) {
      const until = new Date(untilParam);
      if (!Number.isNaN(until.getTime())) {
        conditions.push(lte(notifications.createdAt, until));
      }
    }

    const updated = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date(), updatedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: notifications.id });

    return NextResponse.json({ success: true, count: updated.length });
  } catch (error) {
    console.error('Failed to mark all inbox items as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark all inbox items as read' },
      { status: 500 }
    );
  }
}
