/**
 * GET /api/inbox — unified notification feed for the Smart Inbox.
 *
 * Joins the notifications table with its source rows (issue + project) and
 * the actor user so the inbox UI can render a single, deduplicated list.
 *
 * Filter chips (all optional, all `&`-combined):
 *   - actor_type     user | agent | webhook | system
 *   - notification_type  mention | assignment | due | status | comment | reaction
 *                    (these are external aliases; see TYPE_GROUPS below for
 *                     the mapping to the underlying notification_type enum)
 *   - unread         "true" → only unread rows
 *   - snoozed        "true" → only currently-snoozed rows (snoozed_until > now)
 *                    "false" / omitted → exclude snoozed rows whose timer
 *                                        has not yet elapsed
 *   - project        project id
 *   - since          ISO timestamp lower bound on created_at
 *   - until          ISO timestamp upper bound on created_at
 *   - cursor         opaque cursor (base64 of createdAt|id)
 *   - limit          max 100, default 30
 *
 * Pagination is cursor-based (createdAt desc, id desc tiebreak). When more
 * rows exist `nextCursor` is returned; clients pass it back as `cursor`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  notifications,
  users,
  issues,
  projects,
  eq,
  and,
  or,
  desc,
  gt,
  lt,
  gte,
  lte,
  isNull,
  inArray,
} from '@tasknebula/db';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 30;

// Map the inbox-level "notification_type" chip to the union of underlying
// notification_type enum values it covers. This keeps the user-facing chip
// labels stable even if we add more internal event kinds.
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
  reaction: [], // reserved — reactions don't yet generate notifications
};

type InboxTypeChip = 'mention' | 'assignment' | 'due' | 'status' | 'comment' | 'reaction';
const VALID_TYPE_CHIPS: InboxTypeChip[] = ['mention', 'assignment', 'due', 'status', 'comment', 'reaction'];
const VALID_ACTOR_TYPES = ['user', 'agent', 'webhook', 'system'] as const;
type InboxActorType = (typeof VALID_ACTOR_TYPES)[number];

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(raw: string | null): { createdAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const [iso, id] = decoded.split('|');
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const actorTypeParam = searchParams.get('actor_type');
    const notificationTypeParam = searchParams.get('notification_type');
    const unread = searchParams.get('unread') === 'true';
    const snoozedParam = searchParams.get('snoozed');
    const projectId = searchParams.get('project');
    const sinceParam = searchParams.get('since');
    const untilParam = searchParams.get('until');
    const limitParam = Number(searchParams.get('limit') ?? '');
    const limit = Math.min(
      MAX_LIMIT,
      Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : DEFAULT_LIMIT
    );
    const cursor = decodeCursor(searchParams.get('cursor'));

    const conditions = [eq(notifications.userId, userId)];

    if (actorTypeParam && (VALID_ACTOR_TYPES as readonly string[]).includes(actorTypeParam)) {
      conditions.push(eq(notifications.actorType, actorTypeParam as InboxActorType));
    }

    if (notificationTypeParam && VALID_TYPE_CHIPS.includes(notificationTypeParam as InboxTypeChip)) {
      const enumValues = TYPE_GROUPS[notificationTypeParam] ?? [];
      if (enumValues.length > 0) {
        conditions.push(inArray(notifications.type, enumValues));
      } else {
        // Chip exists but has no underlying events yet — return empty.
        return NextResponse.json({ items: [], nextCursor: null });
      }
    }

    if (unread) {
      conditions.push(eq(notifications.isRead, false));
    }

    // Snooze handling: by default, hide rows whose snooze timer is still in
    // the future. The "Snoozed" chip flips that around. Re-emergence is
    // therefore automatic — once now() passes the timer, the row appears.
    const now = new Date();
    if (snoozedParam === 'true') {
      conditions.push(gt(notifications.snoozedUntil, now));
    } else {
      conditions.push(
        or(isNull(notifications.snoozedUntil), lte(notifications.snoozedUntil, now))!
      );
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

    if (cursor) {
      // (createdAt, id) < (cursor.createdAt, cursor.id) in lexicographic order
      conditions.push(
        or(
          lt(notifications.createdAt, cursor.createdAt),
          and(eq(notifications.createdAt, cursor.createdAt), lt(notifications.id, cursor.id))
        )!
      );
    }

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        actorType: notifications.actorType,
        title: notifications.title,
        message: notifications.message,
        issueId: notifications.issueId,
        projectId: notifications.projectId,
        isRead: notifications.isRead,
        readAt: notifications.readAt,
        snoozedUntil: notifications.snoozedUntil,
        createdAt: notifications.createdAt,
        actor: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
        issue: {
          id: issues.id,
          key: issues.key,
          title: issues.title,
        },
        project: {
          id: projects.id,
          key: projects.key,
          name: projects.name,
        },
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .leftJoin(issues, eq(notifications.issueId, issues.id))
      .leftJoin(projects, eq(notifications.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt as Date, last.id) : null;

    return NextResponse.json({ items, nextCursor });
  } catch (error) {
    console.error('Failed to fetch inbox:', error);
    return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
  }
}
