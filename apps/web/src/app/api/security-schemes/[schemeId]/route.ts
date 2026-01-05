import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issueSecuritySchemes, issueSecurityLevels, issueSecurityLevelMembers, projectSecuritySchemes } from '@tasknebula/db';
import { eq } from 'drizzle-orm';

// GET /api/security-schemes/[schemeId] - Get a specific security scheme with levels
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ schemeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schemeId } = await params;

    const [scheme] = await db
      .select()
      .from(issueSecuritySchemes)
      .where(eq(issueSecuritySchemes.id, schemeId));

    if (!scheme) {
      return NextResponse.json({ error: 'Security scheme not found' }, { status: 404 });
    }

    // Get levels with members
    const levels = await db
      .select()
      .from(issueSecurityLevels)
      .where(eq(issueSecurityLevels.schemeId, schemeId))
      .orderBy(issueSecurityLevels.sortOrder);

    const levelsWithMembers = await Promise.all(
      levels.map(async (level) => {
        const members = await db
          .select()
          .from(issueSecurityLevelMembers)
          .where(eq(issueSecurityLevelMembers.levelId, level.id));
        return { ...level, members };
      })
    );

    // Get project count
    const projectAssignments = await db
      .select()
      .from(projectSecuritySchemes)
      .where(eq(projectSecuritySchemes.schemeId, schemeId));

    return NextResponse.json({
      ...scheme,
      levels: levelsWithMembers,
      projectCount: projectAssignments.length,
    });
  } catch (error) {
    console.error('Error fetching security scheme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/security-schemes/[schemeId] - Update a security scheme
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ schemeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schemeId } = await params;
    const body = await request.json();
    const { name, description, isDefault } = body;

    const [existingScheme] = await db
      .select()
      .from(issueSecuritySchemes)
      .where(eq(issueSecuritySchemes.id, schemeId));

    if (!existingScheme) {
      return NextResponse.json({ error: 'Security scheme not found' }, { status: 404 });
    }

    if (isDefault) {
      await db
        .update(issueSecuritySchemes)
        .set({ isDefault: false, updatedAt: new Date(), updatedBy: session.user.id })
        .where(eq(issueSecuritySchemes.organizationId, existingScheme.organizationId));
    }

    const [updatedScheme] = await db
      .update(issueSecuritySchemes)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isDefault !== undefined && { isDefault }),
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(issueSecuritySchemes.id, schemeId))
      .returning();

    return NextResponse.json(updatedScheme);
  } catch (error) {
    console.error('Error updating security scheme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/security-schemes/[schemeId] - Delete a security scheme
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ schemeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schemeId } = await params;

    const projectAssignments = await db
      .select()
      .from(projectSecuritySchemes)
      .where(eq(projectSecuritySchemes.schemeId, schemeId));

    if (projectAssignments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete scheme that is assigned to projects' },
        { status: 400 }
      );
    }

    await db.delete(issueSecuritySchemes).where(eq(issueSecuritySchemes.id, schemeId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting security scheme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

