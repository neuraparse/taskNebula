import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { db } from '../client';
import { issues, issueComments, issueActivities, users } from '../schema';
import { createId } from '@paralleldrive/cuid2';

export type IssueWithRelations = typeof issues.$inferSelect & {
  assignee?: typeof users.$inferSelect | null;
  reporter?: typeof users.$inferSelect | null;
};

export type CommentWithAuthor = typeof issueComments.$inferSelect & {
  author: typeof users.$inferSelect;
};

// Get all issues with optional filters
export async function getIssues(filters?: {
  projectId?: string;
  assigneeId?: string;
  statusId?: string;
  sprintId?: string;
}) {
  let query = db
    .select({
      issue: issues,
      assignee: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(issues)
    .leftJoin(users, eq(issues.assigneeId, users.id))
    .orderBy(desc(issues.createdAt));

  // Apply filters
  const conditions = [];
  if (filters?.projectId) {
    conditions.push(eq(issues.projectId, filters.projectId));
  }
  if (filters?.assigneeId) {
    conditions.push(eq(issues.assigneeId, filters.assigneeId));
  }
  if (filters?.statusId) {
    conditions.push(eq(issues.statusId, filters.statusId));
  }
  if (filters?.sprintId) {
    conditions.push(eq(issues.sprintId, filters.sprintId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const results = await query;

  return results.map((row) => ({
    ...row.issue,
    assignee: row.assignee,
  }));
}

// Get single issue by ID
export async function getIssueById(issueId: string) {
  const result = await db
    .select({
      issue: issues,
      assignee: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(issues)
    .leftJoin(users, eq(issues.assigneeId, users.id))
    .where(eq(issues.id, issueId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  if (!row) {
    return null;
  }

  return {
    ...row.issue,
    assignee: row.assignee,
  };
}

// Create new issue
export async function createIssue(data: typeof issues.$inferInsert) {
  const result = await db.insert(issues).values(data).returning();
  return result[0];
}

// Update issue
export async function updateIssue(issueId: string, data: Partial<typeof issues.$inferInsert>) {
  const result = await db
    .update(issues)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(issues.id, issueId))
    .returning();

  return result[0];
}

// Delete issue
export async function deleteIssue(issueId: string) {
  await db.delete(issues).where(eq(issues.id, issueId));
  // Drop the matching collaborative-edit doc, if Hocuspocus is in use.
  // The `collab_documents` table is bootstrapped by the hocuspocus service
  // on first start, so it may not exist in deployments that have never
  // enabled live-collab. `to_regclass()` returns NULL when the table is
  // absent, letting us issue the DELETE conditionally without raising
  // "relation does not exist". Document names follow `issue:<id>`.
  try {
    await db.execute(sql`
      DO $$
      BEGIN
        IF to_regclass('public.collab_documents') IS NOT NULL THEN
          DELETE FROM collab_documents WHERE name = ${`issue:${issueId}`};
        END IF;
      END
      $$;
    `);
  } catch (err) {
    // Never let a stale-collab cleanup failure crash the issue delete —
    // worst case is an orphan Y-state row that won't accept new edits
    // (no parent issue, but `userCanAccessDocument` already returns false).
    console.warn('[deleteIssue] failed to clean up collab_documents', err);
  }
}

// Get comments for an issue
export async function getIssueComments(issueId: string) {
  const results = await db
    .select({
      comment: issueComments,
      author: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(issueComments)
    .innerJoin(users, eq(issueComments.createdBy, users.id))
    .where(eq(issueComments.issueId, issueId))
    .orderBy(desc(issueComments.createdAt));

  return results.map((row) => ({
    ...row.comment,
    author: row.author,
  }));
}

// Create comment
export async function createComment(data: typeof issueComments.$inferInsert) {
  const result = await db.insert(issueComments).values(data).returning();
  return result[0];
}

// Get single comment by ID
export async function getCommentById(commentId: string) {
  const result = await db
    .select()
    .from(issueComments)
    .where(eq(issueComments.id, commentId))
    .limit(1);

  return result[0] || null;
}

// Update comment (bumps updatedAt — used for content/mentions edits)
export async function updateComment(
  commentId: string,
  data: Partial<typeof issueComments.$inferInsert>
) {
  const result = await db
    .update(issueComments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(issueComments.id, commentId))
    .returning();

  return result[0];
}

// Replace a comment's reactions WITHOUT bumping updatedAt/updatedBy.
// The "edited" flag is derived from updatedAt > createdAt, so reaction
// toggles must not make a comment look edited.
export async function updateCommentReactions(commentId: string, reactions: unknown[]) {
  const result = await db
    .update(issueComments)
    .set({ reactions })
    .where(eq(issueComments.id, commentId))
    .returning();

  return result[0];
}

// True when the comment has threaded replies (parentId children).
// parent_id is ON DELETE CASCADE, so callers should check this before a
// hard delete to avoid silently destroying a thread.
export async function hasCommentReplies(commentId: string): Promise<boolean> {
  const result = await db
    .select({ id: issueComments.id })
    .from(issueComments)
    .where(eq(issueComments.parentId, commentId))
    .limit(1);

  return result.length > 0;
}

// Hard-delete a comment (callers must enforce the no-replies rule first)
export async function deleteComment(commentId: string) {
  const result = await db
    .delete(issueComments)
    .where(eq(issueComments.id, commentId))
    .returning({ id: issueComments.id });

  return result[0] || null;
}

// Get issue activities
export async function getIssueActivities(issueId: string) {
  const results = await db
    .select({
      activity: issueActivities,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(issueActivities)
    .leftJoin(users, eq(issueActivities.userId, users.id))
    .where(eq(issueActivities.issueId, issueId))
    .orderBy(desc(issueActivities.createdAt));

  return results.map((row) => ({
    ...row.activity,
    user: row.user,
  }));
}

// Create activity log
export async function createActivity(data: {
  issueId: string;
  userId: string;
  type:
    | 'created'
    | 'updated'
    | 'status_changed'
    | 'assigned'
    | 'commented'
    | 'linked'
    | 'mentioned';
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: any;
}) {
  const result = await db
    .insert(issueActivities)
    .values({
      id: createId(),
      issueId: data.issueId,
      userId: data.userId,
      type: data.type,
      field: data.field || null,
      oldValue: data.oldValue || null,
      newValue: data.newValue || null,
      metadata: data.metadata || {},
      createdBy: data.userId,
      updatedBy: data.userId,
    })
    .returning();

  return result[0];
}
