import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, customFieldValues, customFields } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const setCustomFieldValueSchema = z.object({
  customFieldId: z.string(),
  value: z.string().nullable(),
});

// GET /api/issues/[issueId]/custom-fields
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    // Fetch all custom field values for this issue with field definitions
    const values = await db
      .select({
        id: customFieldValues.id,
        customFieldId: customFieldValues.customFieldId,
        value: customFieldValues.value,
        createdAt: customFieldValues.createdAt,
        updatedAt: customFieldValues.updatedAt,
        field: {
          id: customFields.id,
          name: customFields.name,
          description: customFields.description,
          type: customFields.type,
          isRequired: customFields.isRequired,
          options: customFields.options,
        },
      })
      .from(customFieldValues)
      .innerJoin(customFields, eq(customFieldValues.customFieldId, customFields.id))
      .where(eq(customFieldValues.issueId, issueId));

    return NextResponse.json({ customFieldValues: values });
  } catch (error) {
    console.error('Error fetching custom field values:', error);
    return NextResponse.json({ error: 'Failed to fetch custom field values' }, { status: 500 });
  }
}

// POST /api/issues/[issueId]/custom-fields
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
    const body = await request.json();
    const validatedData = setCustomFieldValueSchema.parse(body);

    // Check if value already exists
    const [existingValue] = await db
      .select()
      .from(customFieldValues)
      .where(
        and(
          eq(customFieldValues.issueId, issueId),
          eq(customFieldValues.customFieldId, validatedData.customFieldId)
        )
      )
      .limit(1);

    if (existingValue) {
      // Update existing value
      const [updatedValue] = await db
        .update(customFieldValues)
        .set({
          value: validatedData.value,
          updatedBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(customFieldValues.id, existingValue.id))
        .returning();

      return NextResponse.json(updatedValue);
    } else {
      // Create new value
      const [newValue] = await db
        .insert(customFieldValues)
        .values({
          issueId,
          customFieldId: validatedData.customFieldId,
          value: validatedData.value,
          createdBy: session.user.id,
          updatedBy: session.user.id,
        })
        .returning();

      return NextResponse.json(newValue, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    console.error('Error setting custom field value:', error);
    return NextResponse.json({ error: 'Failed to set custom field value' }, { status: 500 });
  }
}

// DELETE /api/issues/[issueId]/custom-fields?customFieldId=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;
    const { searchParams } = new URL(request.url);
    const customFieldId = searchParams.get('customFieldId');

    if (!customFieldId) {
      return NextResponse.json({ error: 'customFieldId is required' }, { status: 400 });
    }

    await db
      .delete(customFieldValues)
      .where(
        and(
          eq(customFieldValues.issueId, issueId),
          eq(customFieldValues.customFieldId, customFieldId)
        )
      );

    return NextResponse.json({ message: 'Custom field value deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom field value:', error);
    return NextResponse.json({ error: 'Failed to delete custom field value' }, { status: 500 });
  }
}

