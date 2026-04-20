import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issueSecuritySchemes, issueSecurityLevels, issueSecurityLevelMembers, projectSecuritySchemes } from '@tasknebula/db';
import { eq, desc, inArray } from 'drizzle-orm';

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

    // Batch fetch levels, level members, and project assignments
    type SecurityLevelRow = typeof issueSecurityLevels.$inferSelect;
    type LevelMemberRow = typeof issueSecurityLevelMembers.$inferSelect;

    const schemeIds = schemes.map((s) => s.id);
    const levelsByScheme = new Map<string, (SecurityLevelRow & { members: LevelMemberRow[] })[]>();
    const projectCountsByScheme = new Map<string, number>();

    if (schemeIds.length > 0) {
      const allLevels = await db
        .select()
        .from(issueSecurityLevels)
        .where(inArray(issueSecurityLevels.schemeId, schemeIds))
        .orderBy(issueSecurityLevels.sortOrder);

      const levelIds = allLevels.map((l) => l.id);
      const membersByLevel = new Map<string, LevelMemberRow[]>();

      if (levelIds.length > 0) {
        const allMembers = await db
          .select()
          .from(issueSecurityLevelMembers)
          .where(inArray(issueSecurityLevelMembers.levelId, levelIds));

        for (const member of allMembers) {
          const list = membersByLevel.get(member.levelId) || [];
          list.push(member);
          membersByLevel.set(member.levelId, list);
        }
      }

      for (const level of allLevels) {
        const list = levelsByScheme.get(level.schemeId) || [];
        list.push({ ...level, members: membersByLevel.get(level.id) || [] });
        levelsByScheme.set(level.schemeId, list);
      }

      const assignments = await db
        .select({ schemeId: projectSecuritySchemes.schemeId })
        .from(projectSecuritySchemes)
        .where(inArray(projectSecuritySchemes.schemeId, schemeIds));

      for (const row of assignments) {
        projectCountsByScheme.set(row.schemeId, (projectCountsByScheme.get(row.schemeId) || 0) + 1);
      }
    }

    const schemesWithLevels = schemes.map((scheme) => ({
      ...scheme,
      levels: levelsByScheme.get(scheme.id) || [],
      projectCount: projectCountsByScheme.get(scheme.id) || 0,
    }));

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
