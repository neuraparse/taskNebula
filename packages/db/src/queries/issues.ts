import { eq, and, desc, inArray } from 'drizzle-orm';
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
  status?: string;
  sprintId?: string;
}) {
  let query = db
    .select({
      issue: issues,
      assignee: users,
      reporter: users,
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
  if (filters?.status) {
    conditions.push(eq(issues.status, filters.status));
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
      assignee: users,
      reporter: users,
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
    reporter: row.reporter,
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
}

// Get comments for an issue
export async function getIssueComments(issueId: string) {
  const results = await db
    .select({
      comment: issueComments,
      author: users,
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

// Get issue activities
export async function getIssueActivities(issueId: string) {
  const results = await db
    .select({
      activity: issueActivities,
      user: users,
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
  type: 'created' | 'updated' | 'status_changed' | 'assigned' | 'commented' | 'linked' | 'mentioned';
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: any;
}) {
  const result = await db.insert(issueActivities).values({
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
  }).returning();

  return result[0];
}
