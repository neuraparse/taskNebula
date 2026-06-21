import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, automationRules } from '@tasknebula/db';
import { eq, and, or, isNull, desc } from 'drizzle-orm';
import { authorizeAutomationScope } from '@/lib/automation/access';

function automationScopeResponse(status: 'not-found' | 'forbidden') {
  if (status === 'not-found') {
    return NextResponse.json({ error: 'Automation scope not found' }, { status: 404 });
  }

  return NextResponse.json(
    { error: 'Managing automation requires project or organization settings permission' },
    { status: 403 }
  );
}

// GET /api/automation-rules - List automation rules
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const projectId = searchParams.get('projectId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const access = await authorizeAutomationScope(session.user.id, organizationId, projectId);
    if (access.status !== 'ok') {
      return automationScopeResponse(access.status);
    }

    let query = db
      .select()
      .from(automationRules)
      .where(eq(automationRules.organizationId, organizationId))
      .orderBy(desc(automationRules.enabled), automationRules.name);

    // Filter by project if specified
    if (projectId) {
      const projectScopedId = access.projectId;
      if (!projectScopedId) {
        return automationScopeResponse('not-found');
      }

      query = db
        .select()
        .from(automationRules)
        .where(
          and(
            eq(automationRules.organizationId, organizationId),
            or(eq(automationRules.projectId, projectScopedId), isNull(automationRules.projectId))
          )
        )
        .orderBy(desc(automationRules.enabled), automationRules.name);
    }

    const rules = await query;

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/automation-rules - Create a new automation rule
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, projectId, name, description, enabled, trigger, conditions, actions } =
      body;

    if (!organizationId || !name || !trigger || !actions) {
      return NextResponse.json(
        { error: 'Organization ID, name, trigger, and actions are required' },
        { status: 400 }
      );
    }

    const access = await authorizeAutomationScope(session.user.id, organizationId, projectId);
    if (access.status !== 'ok') {
      return automationScopeResponse(access.status);
    }

    const [rule] = await db
      .insert(automationRules)
      .values({
        organizationId: access.organizationId,
        projectId: access.projectId,
        name,
        description: description || null,
        enabled: enabled !== undefined ? enabled : true,
        trigger,
        conditions: conditions || [],
        actions,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Error creating automation rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
