import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, notificationPreferences } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// DND start/end are HH:MM strings OR null when unset.
// Client state holds `null` until the user enables DND and picks a time, so the
// API must accept null, not just string | undefined — otherwise the first save
// from a fresh user (or anyone with DND off) fails with a 400.
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM')
  .nullable()
  .optional();

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
  emailOnProjectCreated: z.boolean().optional(),
  emailOnProjectArchived: z.boolean().optional(),
  inAppOnAssigned: z.boolean().optional(),
  inAppOnMentioned: z.boolean().optional(),
  inAppOnCommented: z.boolean().optional(),
  inAppOnStatusChanged: z.boolean().optional(),
  inAppOnIssueCreated: z.boolean().optional(),
  inAppOnSprintStarted: z.boolean().optional(),
  inAppOnSprintCompleted: z.boolean().optional(),
  inAppOnProjectCreated: z.boolean().optional(),
  inAppOnProjectArchived: z.boolean().optional(),
  doNotDisturb: z.boolean().optional(),
  doNotDisturbStart: timeString,
  doNotDisturbEnd: timeString,
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
    const canView = await hasPermission(organizationId, 'org:view');
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, session.user.id),
          eq(notificationPreferences.organizationId, organizationId)
        )
      );

    // If no preferences found, return defaults.
    // Email defaults are QUIET by design: only assigned + mentioned are opt-in.
    // All other events require the user to enable them explicitly.
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
          emailOnCommented: false,
          emailOnStatusChanged: false,
          emailOnIssueCreated: false,
          emailOnSprintStarted: true,
          emailOnSprintCompleted: true,
          emailOnProjectCreated: false,
          emailOnProjectArchived: false,
          inAppOnAssigned: true,
          inAppOnMentioned: true,
          inAppOnCommented: true,
          inAppOnStatusChanged: true,
          inAppOnIssueCreated: true,
          inAppOnSprintStarted: true,
          inAppOnSprintCompleted: true,
          inAppOnProjectCreated: true,
          inAppOnProjectArchived: true,
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

    const canView = await hasPermission(validatedData.organizationId, 'org:view');
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

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
