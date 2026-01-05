import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, notificationPreferences } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updatePreferencesSchema = z.object({
  organizationId: z.string(),
  enableInApp: z.boolean().optional(),
  enableEmail: z.boolean().optional(),
  digestFrequency: z.enum(['none', 'daily', 'weekly']).optional(),
  emailOnAssigned: z.boolean().optional(),
  emailOnMentioned: z.boolean().optional(),
  emailOnCommented: z.boolean().optional(),
  emailOnStatusChanged: z.boolean().optional(),
  emailOnIssueCreated: z.boolean().optional(),
  emailOnSprintStarted: z.boolean().optional(),
  emailOnSprintCompleted: z.boolean().optional(),
  inAppOnAssigned: z.boolean().optional(),
  inAppOnMentioned: z.boolean().optional(),
  inAppOnCommented: z.boolean().optional(),
  inAppOnStatusChanged: z.boolean().optional(),
  inAppOnIssueCreated: z.boolean().optional(),
  inAppOnSprintStarted: z.boolean().optional(),
  inAppOnSprintCompleted: z.boolean().optional(),
  doNotDisturb: z.boolean().optional(),
  doNotDisturbStart: z.string().optional(),
  doNotDisturbEnd: z.string().optional(),
});

/**
 * GET /api/notification-preferences?organizationId=xxx
 * 
 * Get notification preferences for current user in an organization
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json(
      { error: 'organizationId is required' },
      { status: 400 }
    );
  }

  try {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, session.user.id),
          eq(notificationPreferences.organizationId, organizationId)
        )
      );

    // If no preferences found, return defaults
    if (!prefs) {
      return NextResponse.json({
        preferences: {
          userId: session.user.id,
          organizationId,
          enableInApp: true,
          enableEmail: true,
          digestFrequency: 'none',
          emailOnAssigned: true,
          emailOnMentioned: true,
          emailOnCommented: true,
          emailOnStatusChanged: false,
          emailOnIssueCreated: false,
          emailOnSprintStarted: false,
          emailOnSprintCompleted: false,
          inAppOnAssigned: true,
          inAppOnMentioned: true,
          inAppOnCommented: true,
          inAppOnStatusChanged: true,
          inAppOnIssueCreated: true,
          inAppOnSprintStarted: true,
          inAppOnSprintCompleted: true,
          doNotDisturb: false,
          doNotDisturbStart: null,
          doNotDisturbEnd: null,
        },
      });
    }

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notification-preferences
 * 
 * Create or update notification preferences
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validatedData = updatePreferencesSchema.parse(body);

    // Check if preferences already exist
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, session.user.id),
          eq(notificationPreferences.organizationId, validatedData.organizationId)
        )
      );

    let result;

    if (existing) {
      // Update existing preferences
      [result] = await db
        .update(notificationPreferences)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.id, existing.id))
        .returning();
    } else {
      // Create new preferences
      [result] = await db
        .insert(notificationPreferences)
        .values({
          userId: session.user.id,
          ...validatedData,
        })
        .returning();
    }

    return NextResponse.json({ preferences: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}

