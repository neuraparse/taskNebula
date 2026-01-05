import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, automationRules } from '@tasknebula/db';
import { eq, and, or, isNull, desc } from 'drizzle-orm';

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

    let query = db
      .select()
      .from(automationRules)
      .where(eq(automationRules.organizationId, organizationId))
      .orderBy(desc(automationRules.enabled), automationRules.name);

    // Filter by project if specified
    if (projectId) {
      query = db
        .select()
        .from(automationRules)
        .where(
          and(
            eq(automationRules.organizationId, organizationId),
            or(
              eq(automationRules.projectId, projectId),
              isNull(automationRules.projectId)
            )
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
    const { organizationId, projectId, name, description, enabled, trigger, conditions, actions } = body;

    if (!organizationId || !name || !trigger || !actions) {
      return NextResponse.json(
        { error: 'Organization ID, name, trigger, and actions are required' },
        { status: 400 }
      );
    }

    const [rule] = await db
      .insert(automationRules)
      .values({
        organizationId,
        projectId: projectId || null,
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
