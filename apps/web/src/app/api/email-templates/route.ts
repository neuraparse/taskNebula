import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, emailTemplates } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

const createEmailTemplateSchema = z.object({
  organizationId: z.string(),
  type: z.enum([
    'issue_assigned',
    'issue_mentioned',
    'issue_commented',
    'issue_status_changed',
    'issue_created',
    'sprint_started',
    'sprint_completed',
    'daily_digest',
    'weekly_digest',
  ]),
  name: z.string().min(1),
  subject: z.string().min(1),
  htmlBody: z.string().min(1),
  textBody: z.string().min(1),
});

const updateEmailTemplateSchema = createEmailTemplateSchema.partial().omit({
  organizationId: true,
  type: true,
});

/**
 * GET /api/email-templates?organizationId=xxx&type=xxx
 * 
 * Get email templates for an organization
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const type = searchParams.get('type');

  if (!organizationId) {
    return NextResponse.json(
      { error: 'organizationId is required' },
      { status: 400 }
    );
  }

  // Require org:settings permission (owner/admin) to view email templates.
  const canView = await hasPermission(organizationId, 'org:settings');
  if (!canView) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const conditions = [eq(emailTemplates.organizationId, organizationId)];
    if (type) {
      conditions.push(eq(emailTemplates.type, type as any));
    }

    const templates = await db
      .select()
      .from(emailTemplates)
      .where(and(...conditions));

    return NextResponse.json({ emailTemplates: templates });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/email-templates
 * 
 * Create a new email template
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validatedData = createEmailTemplateSchema.parse(body);

    // Require org:settings permission (owner/admin) on the target org.
    const canManage = await hasPermission(validatedData.organizationId, 'org:settings');
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const [newTemplate] = await db
      .insert(emailTemplates)
      .values({
        ...validatedData,
        createdBy: session.user.id,
        isDefault: false,
      })
      .returning();

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating email template:', error);
    return NextResponse.json(
      { error: 'Failed to create email template' },
      { status: 500 }
    );
  }
}

