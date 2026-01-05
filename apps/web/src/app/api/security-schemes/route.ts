import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issueSecuritySchemes, issueSecurityLevels, issueSecurityLevelMembers } from '@tasknebula/db';
import { eq, desc } from 'drizzle-orm';

// GET /api/security-schemes - List all issue security schemes for an organization
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const schemes = await db
      .select({
        id: issueSecuritySchemes.id,
        name: issueSecuritySchemes.name,
        description: issueSecuritySchemes.description,
        isDefault: issueSecuritySchemes.isDefault,
        createdAt: issueSecuritySchemes.createdAt,
        updatedAt: issueSecuritySchemes.updatedAt,
      })
      .from(issueSecuritySchemes)
      .where(eq(issueSecuritySchemes.organizationId, organizationId))
      .orderBy(desc(issueSecuritySchemes.isDefault), issueSecuritySchemes.name);

    // Get levels for each scheme
    const schemesWithLevels = await Promise.all(
      schemes.map(async (scheme) => {
        const levels = await db
          .select()
          .from(issueSecurityLevels)
          .where(eq(issueSecurityLevels.schemeId, scheme.id))
          .orderBy(issueSecurityLevels.sortOrder);
        return { ...scheme, levels };
      })
    );

    return NextResponse.json(schemesWithLevels);
  } catch (error) {
    console.error('Error fetching security schemes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/security-schemes - Create a new issue security scheme
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, name, description, isDefault, levels } = body;

    if (!organizationId || !name) {
      return NextResponse.json({ error: 'Organization ID and name are required' }, { status: 400 });
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await db
        .update(issueSecuritySchemes)
        .set({ isDefault: false, updatedAt: new Date(), updatedBy: session.user.id })
        .where(eq(issueSecuritySchemes.organizationId, organizationId));
    }

    const [scheme] = await db
      .insert(issueSecuritySchemes)
      .values({
        organizationId,
        name,
        description: description || null,
        isDefault: isDefault || false,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    // Create default levels if provided
    if (levels && Array.isArray(levels) && scheme) {
      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        const [createdLevel] = await db
          .insert(issueSecurityLevels)
          .values({
            schemeId: scheme.id,
            name: level.name,
            description: level.description || null,
            sortOrder: i,
            isDefault: level.isDefault || false,
          })
          .returning();

        // Add members to level
        if (createdLevel && level.members && Array.isArray(level.members)) {
          for (const member of level.members) {
            await db.insert(issueSecurityLevelMembers).values({
              levelId: createdLevel.id,
              memberType: member.type,
              memberValue: member.value || null,
            });
          }
        }
      }
    }

    return NextResponse.json(scheme, { status: 201 });
  } catch (error) {
    console.error('Error creating security scheme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

