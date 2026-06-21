import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  automationRules,
  organizationMembers,
  projectMembers,
  users,
  hasPermission as roleHasPermission,
} from '@tasknebula/db';
import { and, eq, sql } from 'drizzle-orm';

// Local stub type for the automation_executions row.
// The dedicated `automationExecutions` table is defined in the db package
// (`packages/db/src/schema/automation-executions.ts`) but is not re-exported
// through `@tasknebula/db` yet — another agent owns the schema/engine work.
// Using raw SQL keeps this route unblocked for typecheck until the barrel
// export lands; merge will clean this up to use the typed table directly.
type AutomationExecutionRow = {
  id: string;
  rule_id: string;
  triggered_at: string | Date;
  trigger_payload: unknown;
  status: string;
  action_results: unknown;
  duration_ms: number | null;
  error: string | null;
  [key: string]: unknown;
};

export interface AutomationExecutionDto {
  id: string;
  ruleId: string;
  triggeredAt: string;
  triggerPayload: unknown;
  status: string;
  actionResults: unknown;
  durationMs: number | null;
  error: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// GET /api/automation-rules/[ruleId]/executions?limit=50
// Returns recent executions for a rule, ordered by triggeredAt desc.
// Auth: caller must have org management permission, or for project-scoped
// rules be a member of that project. Super admins are always allowed.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { ruleId } = await params;

    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get('limit'));
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    // Look up rule to know which org/project it belongs to.
    const [rule] = await db
      .select({
        id: automationRules.id,
        organizationId: automationRules.organizationId,
        projectId: automationRules.projectId,
      })
      .from(automationRules)
      .where(eq(automationRules.id, ruleId))
      .limit(1);

    if (!rule) {
      return NextResponse.json({ error: 'Automation rule not found' }, { status: 404 });
    }

    // Super admin bypass.
    const [user] = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    let allowed = Boolean(user?.isSuperAdmin);

    if (!allowed) {
      const [orgMember] = await db
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, rule.organizationId),
            eq(organizationMembers.status, 'active')
          )
        )
        .limit(1);

      if (roleHasPermission(orgMember?.role || '', 'org:manage')) {
        allowed = true;
      } else if (rule.projectId) {
        // Rule scoped to a project — check project membership.
        const [projectMember] = await db
          .select({ role: projectMembers.role })
          .from(projectMembers)
          .where(
            and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, rule.projectId))
          )
          .limit(1);
        allowed = Boolean(projectMember);
      } else {
        // Org-wide rule executions require organization management permission.
        allowed = false;
      }
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Raw SQL query — see note above about the stub type.
    const result = await db.execute<AutomationExecutionRow>(sql`
      SELECT
        id,
        rule_id,
        triggered_at,
        trigger_payload,
        status,
        action_results,
        duration_ms,
        error
      FROM automation_executions
      WHERE rule_id = ${ruleId}
      ORDER BY triggered_at DESC
      LIMIT ${limit}
    `);

    // drizzle's `db.execute` returns either an array of rows or a result
    // object with `.rows` depending on driver — handle both shapes.
    const rawRows: AutomationExecutionRow[] = Array.isArray(result)
      ? (result as AutomationExecutionRow[])
      : ((result as { rows?: AutomationExecutionRow[] }).rows ?? []);

    const executions: AutomationExecutionDto[] = rawRows.map((row) => ({
      id: row.id,
      ruleId: row.rule_id,
      triggeredAt:
        row.triggered_at instanceof Date
          ? row.triggered_at.toISOString()
          : new Date(row.triggered_at).toISOString(),
      triggerPayload: row.trigger_payload,
      status: row.status,
      actionResults: row.action_results,
      durationMs: row.duration_ms,
      error: row.error,
    }));

    return NextResponse.json(executions);
  } catch (error) {
    // If the table doesn't exist yet in this environment, return an empty
    // list rather than 500 so the UI can still render a sensible empty state.
    const message = error instanceof Error ? error.message : String(error);
    if (
      /automation_executions/i.test(message) &&
      /does not exist|undefined table|no such table/i.test(message)
    ) {
      return NextResponse.json([]);
    }
    console.error('Error fetching automation executions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
