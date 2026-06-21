import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, automationRules } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { authorizeAutomationRule } from '@/lib/automation/access';

function automationAccessResponse(status: 'not-found' | 'forbidden') {
  if (status === 'not-found') {
    return NextResponse.json({ error: 'Automation rule not found' }, { status: 404 });
  }

  return NextResponse.json(
    { error: 'Managing automation requires project or organization settings permission' },
    { status: 403 }
  );
}

// GET /api/automation-rules/[ruleId] - Get a specific rule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ruleId } = await params;

    const access = await authorizeAutomationRule(session.user.id, ruleId);
    if (access.status !== 'ok') {
      return automationAccessResponse(access.status);
    }

    const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, ruleId));

    if (!rule) {
      return NextResponse.json({ error: 'Automation rule not found' }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error fetching automation rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/automation-rules/[ruleId] - Update a rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ruleId } = await params;
    const body = await request.json();
    const { name, description, enabled, trigger, conditions, actions } = body;

    const access = await authorizeAutomationRule(session.user.id, ruleId);
    if (access.status !== 'ok') {
      return automationAccessResponse(access.status);
    }

    const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, ruleId));

    if (!rule) {
      return NextResponse.json({ error: 'Automation rule not found' }, { status: 404 });
    }

    const [updatedRule] = await db
      .update(automationRules)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(enabled !== undefined && { enabled }),
        ...(trigger && { trigger }),
        ...(conditions && { conditions }),
        ...(actions && { actions }),
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(automationRules.id, ruleId))
      .returning();

    return NextResponse.json(updatedRule);
  } catch (error) {
    console.error('Error updating automation rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/automation-rules/[ruleId] - Delete a rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ruleId } = await params;

    const access = await authorizeAutomationRule(session.user.id, ruleId);
    if (access.status !== 'ok') {
      return automationAccessResponse(access.status);
    }

    await db.delete(automationRules).where(eq(automationRules.id, ruleId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
