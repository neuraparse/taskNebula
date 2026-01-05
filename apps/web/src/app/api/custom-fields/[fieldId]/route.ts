import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, customFields } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateCustomFieldSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isRequired: z.boolean().optional(),
  defaultValue: z.string().optional(),
  options: z.string().optional(),
  position: z.number().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/custom-fields/[fieldId]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fieldId } = await params;

    const [field] = await db
      .select()
      .from(customFields)
      .where(eq(customFields.id, fieldId))
      .limit(1);

    if (!field) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 });
    }

    return NextResponse.json(field);
  } catch (error) {
    console.error('Error fetching custom field:', error);
    return NextResponse.json({ error: 'Failed to fetch custom field' }, { status: 500 });
  }
}

// PATCH /api/custom-fields/[fieldId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fieldId } = await params;
    const body = await request.json();
    const validatedData = updateCustomFieldSchema.parse(body);

    const [updatedField] = await db
      .update(customFields)
      .set({
        ...validatedData,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(customFields.id, fieldId))
      .returning();

    if (!updatedField) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 });
    }

    return NextResponse.json(updatedField);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    console.error('Error updating custom field:', error);
    return NextResponse.json({ error: 'Failed to update custom field' }, { status: 500 });
  }
}

// DELETE /api/custom-fields/[fieldId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fieldId } = await params;

    // Soft delete by setting isActive to false
    const [deletedField] = await db
      .update(customFields)
      .set({
        isActive: false,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(customFields.id, fieldId))
      .returning();

    if (!deletedField) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Custom field deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom field:', error);
    return NextResponse.json({ error: 'Failed to delete custom field' }, { status: 500 });
  }
}

