/**
 * POST /api/issues/[issueId]/triage/apply
 *
 * Applies a stored triage suggestion to an issue. The caller can either:
 *   - pass `{ suggestionId }` to apply a specific row, or
 *   - omit it to apply the most recent pending suggestion.
 *
 * A suggestion is "auto-applicable" when its confidence >= the workspace
 * setting `settings.triage.autoApplyConfidence` (default 90). Lower-
 * confidence suggestions require an explicit `{ approved: true }` flag
 * so a human is recorded as approving the change.
 *
 * Mutations performed (only when set in the payload):
 *   - issues.priority       (always replaceable; medium is a safe default)
 *   - issues.labels         (merged union with existing labels)
 *   - issues.assigneeId     (only when the issue has no assignee yet — we
 *                            never overwrite a human assignment)
 *
 * `team_id` is recorded on the suggestion row but not applied to the
 * issue today (no team_id column on issues yet — see follow-up TODO at
 * the bottom of this file).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createActivity,
  createAuditLog,
  db,
  desc,
  eq,
  getIssueById,
  issueTriageSuggestions,
  issues,
  organizationMembers,
  organizations,
  projectMembers,
  projects,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission as roleHasPermission,
  users,
  type ProjectRole,
} from '@tasknebula/db';
import { and, isNull } from 'drizzle-orm';
import { auth } from '@/auth';
import { publishEvent } from '@/lib/realtime/events';
import type { TriageSuggestionPayload } from '@/lib/agents/triage';
import { guardAgentAction } from '@/lib/agent-policy/guard';

const applyBodySchema = z.object({
  suggestionId: z.string().optional(),
  approved: z.boolean().optional(),
});

const DEFAULT_AUTO_APPLY_CONFIDENCE = 90;

async function callerCanEdit(userId: string, projectId: string): Promise<boolean> {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.isSuperAdmin) return true;

  const [project] = await db
    .select({ id: projects.id, organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return false;

  const [orgMember] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, project.organizationId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);
  if (roleHasPermission(orgMember?.role || '', 'project:manage')) return true;

  const [pm] = await db
    .select({ role: projectMembers.role, canEditIssues: projectMembers.canEditIssues })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);
  if (!pm) return false;
  const roleDefaults =
    ROLE_DEFAULT_PERMISSIONS[pm.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
  return pm.canEditIssues === 'true' || roleDefaults.canEditIssues;
}

async function autoApplyConfidenceFor(organizationId: string): Promise<number> {
  const [org] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const triageSection = (settings.triage ?? {}) as Record<string, unknown>;
  const raw = triageSection.autoApplyConfidence;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_AUTO_APPLY_CONFIDENCE;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { issueId } = await params;
    const userId = session.user.id;

    const body = applyBodySchema.parse(await request.json().catch(() => ({})));

    const currentIssue = await getIssueById(issueId);
    if (!currentIssue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    if (!(await callerCanEdit(userId, currentIssue.projectId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load the target suggestion (specific id, or most recent pending).
    const targetRow = body.suggestionId
      ? (
          await db
            .select()
            .from(issueTriageSuggestions)
            .where(eq(issueTriageSuggestions.id, body.suggestionId))
            .limit(1)
        )[0]
      : (
          await db
            .select()
            .from(issueTriageSuggestions)
            .where(
              and(
                eq(issueTriageSuggestions.issueId, issueId),
                isNull(issueTriageSuggestions.appliedAt),
                isNull(issueTriageSuggestions.dismissedAt)
              )
            )
            .orderBy(desc(issueTriageSuggestions.createdAt))
            .limit(1)
        )[0];

    if (!targetRow) {
      return NextResponse.json({ error: 'No pending triage suggestion found' }, { status: 404 });
    }
    if (targetRow.issueId !== issueId) {
      return NextResponse.json(
        { error: 'Suggestion does not belong to this issue' },
        { status: 400 }
      );
    }
    if (targetRow.appliedAt || targetRow.dismissedAt) {
      return NextResponse.json({ error: 'Suggestion has already been resolved' }, { status: 409 });
    }

    // Confidence gate: either auto-applicable, or human-approved.
    const threshold = await autoApplyConfidenceFor(currentIssue.organizationId);
    const autoOk = targetRow.confidence >= threshold;
    if (!autoOk && !body.approved) {
      return NextResponse.json(
        {
          error: 'Confidence below auto-apply threshold; pass { approved: true } to apply.',
          confidence: targetRow.confidence,
          threshold,
        },
        { status: 412 }
      );
    }

    const payload = targetRow.payload as TriageSuggestionPayload;

    // Compute the mutation set. We refuse to overwrite an existing
    // human assignment — the agent's pick only fills empty slots.
    const update: Partial<typeof issues.$inferInsert> = {};
    if (payload.priority && payload.priority !== currentIssue.priority) {
      update.priority = payload.priority;
    }
    if (Array.isArray(payload.labels) && payload.labels.length > 0) {
      const existing = Array.isArray(currentIssue.labels) ? (currentIssue.labels as string[]) : [];
      const merged = Array.from(new Set([...existing, ...payload.labels])).slice(0, 16);
      update.labels = merged;
    }
    if (
      payload.suggested_assignee_id &&
      !currentIssue.assigneeId &&
      typeof payload.suggested_assignee_id === 'string'
    ) {
      update.assigneeId = payload.suggested_assignee_id;
    }

    if (Object.keys(update).length > 0) {
      let policyAction = 'update';
      if (update.assigneeId !== undefined) policyAction = 'assign';
      else if (update.labels !== undefined) policyAction = 'label';

      const guard = await guardAgentAction({
        workspaceId: currentIssue.organizationId,
        projectId: currentIssue.projectId,
        requestedBy: userId,
        actor: 'tasknebula-ai',
        resource: 'issues',
        action: policyAction,
        targetType: 'issue',
        targetId: issueId,
        proposedPayload: {
          executor: 'issues:update',
          data: {
            issueId,
            data: update,
          },
        },
        context: {
          source: 'triage-agent',
          suggestionId: targetRow.id,
          confidence: targetRow.confidence,
        },
      });
      if (!guard.allowed) {
        return NextResponse.json(guard.body, { status: guard.httpStatus });
      }
    }

    if (Object.keys(update).length > 0) {
      update.updatedBy = userId;
      await db.update(issues).set(update).where(eq(issues.id, issueId));
    }

    await db
      .update(issueTriageSuggestions)
      .set({ appliedAt: new Date(), appliedBy: userId })
      .where(eq(issueTriageSuggestions.id, targetRow.id));

    // Activity + audit so the triage decision is visible in the issue
    // history. Best-effort — failures here must not roll back the apply.
    await Promise.allSettled([
      createActivity({
        issueId,
        userId,
        type: 'updated',
        field: 'triage',
        newValue: JSON.stringify({
          confidence: targetRow.confidence,
          autoApplied: autoOk,
        }),
      } as any),
      createAuditLog({
        userId,
        organizationId: currentIssue.organizationId,
        action: 'issue.updated',
        resourceType: 'issue',
        resourceId: issueId,
        projectId: currentIssue.projectId,
        issueId,
        metadata: {
          source: 'triage_agent',
          confidence: targetRow.confidence,
          autoApplied: autoOk,
          suggestion: payload,
        },
      } as any),
    ]);

    publishEvent('issue.updated', userId, {
      projectId: currentIssue.projectId,
      issueId,
      sprintId: currentIssue.sprintId || undefined,
      organizationId: currentIssue.organizationId,
    });

    return NextResponse.json({
      success: true,
      applied: update,
      suggestionId: targetRow.id,
      autoApplied: autoOk,
      threshold,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('triage apply failed:', error);
    return NextResponse.json({ error: 'Failed to apply triage suggestion' }, { status: 500 });
  }
}

// TODO(P1): when the issue schema gains a `team_id` column (roadmap task
// for team-scoped boards), also apply `payload.team_id` here.
