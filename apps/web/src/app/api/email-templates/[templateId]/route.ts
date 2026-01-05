import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, emailTemplates } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateEmailTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  htmlBody: z.string().min(1).optional(),
  textBody: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/email-templates/[templateId]
 * 
 * Update an email template
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { templateId } = await params;

  try {
    const body = await request.json();
    const validatedData = updateEmailTemplateSchema.parse(body);

    const [updatedTemplate] = await db
      .update(emailTemplates)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, templateId))
      .returning();

    if (!updatedTemplate) {
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating email template:', error);
    return NextResponse.json(
      { error: 'Failed to update email template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/email-templates/[templateId]
 * 
 * Delete an email template
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { templateId } = await params;

  try {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, templateId));

    return NextResponse.json({ message: 'Email template deleted successfully' });
  } catch (error) {
    console.error('Error deleting email template:', error);
    return NextResponse.json(
      { error: 'Failed to delete email template' },
      { status: 500 }
    );
  }
}

