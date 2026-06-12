import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issueSecurityLevels, issueSecurityLevelMembers, issues } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { authorizeSecuritySchemeAccess } from '../../../utils';

type SecurityLevelRow = typeof issueSecurityLevels.$inferSelect;

/**
 * Resolve the level within the scheme from the URL, then authorize against
 * the scheme row's organization. Returns a NextResponse on denial:
 * 404 when the level/scheme does not exist, belongs to another scheme, or
 * the caller is not in the scheme's organization (no cross-org probing);
 * 403 when the caller is an org member without `org:settings`.
 */
async function authorizeLevelAccess(
  userId: string,
  schemeId: string,
  levelId: string
): Promise<{ level: SecurityLevelRow } | { errorResponse: NextResponse }> {
  const [level] = await db
    .select()
    .from(issueSecurityLevels)
    .where(eq(issueSecurityLevels.id, levelId))
    .limit(1);

  if (!level || level.schemeId !== schemeId) {
    return {
      errorResponse: NextResponse.json({ error: 'Security level not found' }, { status: 404 }),
    };
  }

  const access = await authorizeSecuritySchemeAccess(userId, schemeId);
  if (access.status === 'not-found') {
    return {
      errorResponse: NextResponse.json({ error: 'Security level not found' }, { status: 404 }),
    };
  }
  if (access.status === 'forbidden') {
    return {
      errorResponse: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
    };
  }

  return { level };
}

// GET /api/security-schemes/[schemeId]/levels/[levelId] - Get a specific level
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ schemeId: string; levelId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schemeId, levelId } = await params;

    const result = await authorizeLevelAccess(session.user.id, schemeId, levelId);
    if ('errorResponse' in result) {
      return result.errorResponse;
    }
    const level = result.level;

    const members = await db
      .select()
      .from(issueSecurityLevelMembers)
      .where(eq(issueSecurityLevelMembers.levelId, levelId));

    return NextResponse.json({ ...level, members });
  } catch (error) {
    console.error('Error fetching security level:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/security-schemes/[schemeId]/levels/[levelId] - Update a level
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ schemeId: string; levelId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schemeId, levelId } = await params;
    const body = await request.json();
    const { name, description, isDefault, members } = body;

    const result = await authorizeLevelAccess(session.user.id, schemeId, levelId);
    if ('errorResponse' in result) {
      return result.errorResponse;
    }

    if (isDefault) {
      await db
        .update(issueSecurityLevels)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(issueSecurityLevels.schemeId, schemeId));
    }

    const [updatedLevel] = await db
      .update(issueSecurityLevels)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isDefault !== undefined && { isDefault }),
        updatedAt: new Date(),
      })
      .where(eq(issueSecurityLevels.id, levelId))
      .returning();

    // Update members if provided
    if (members && Array.isArray(members)) {
      // Delete existing members
      await db
        .delete(issueSecurityLevelMembers)
        .where(eq(issueSecurityLevelMembers.levelId, levelId));

      // Add new members
      for (const member of members) {
        await db.insert(issueSecurityLevelMembers).values({
          levelId,
          memberType: member.type,
          memberValue: member.value || null,
        });
      }
    }

    const levelMembers = await db
      .select()
      .from(issueSecurityLevelMembers)
      .where(eq(issueSecurityLevelMembers.levelId, levelId));

    return NextResponse.json({ ...updatedLevel, members: levelMembers });
  } catch (error) {
    console.error('Error updating security level:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/security-schemes/[schemeId]/levels/[levelId] - Delete a level
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ schemeId: string; levelId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schemeId, levelId } = await params;

    const result = await authorizeLevelAccess(session.user.id, schemeId, levelId);
    if ('errorResponse' in result) {
      return result.errorResponse;
    }

    // Check if level is in use by any issues
    const issuesWithLevel = await db
      .select({ id: issues.id })
      .from(issues)
      .where(eq(issues.securityLevelId, levelId))
      .limit(1);

    if (issuesWithLevel.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete level that is assigned to issues' },
        { status: 400 }
      );
    }

    await db.delete(issueSecurityLevels).where(eq(issueSecurityLevels.id, levelId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting security level:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
