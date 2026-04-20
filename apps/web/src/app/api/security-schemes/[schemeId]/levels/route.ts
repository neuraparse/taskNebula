import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issueSecurityLevels, issueSecurityLevelMembers, issueSecuritySchemes } from '@tasknebula/db';
import { eq, max, inArray } from 'drizzle-orm';

// GET /api/security-schemes/[schemeId]/levels - Get all levels for a scheme
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

    type LevelMemberRow = typeof issueSecurityLevelMembers.$inferSelect;
    const levels = await db
      .select()
      .from(issueSecurityLevels)
      .where(eq(issueSecurityLevels.schemeId, schemeId))
      .orderBy(issueSecurityLevels.sortOrder);

    const levelIds = levels.map((l) => l.id);
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

    const levelsWithMembers = levels.map((level) => ({
      ...level,
      members: membersByLevel.get(level.id) || [],
    }));

    return NextResponse.json(levelsWithMembers);
  } catch (error) {
    console.error('Error fetching security levels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/security-schemes/[schemeId]/levels - Create a new security level
export async function POST(
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
    const { name, description, isDefault, members } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Verify scheme exists
    const [scheme] = await db
      .select()
      .from(issueSecuritySchemes)
      .where(eq(issueSecuritySchemes.id, schemeId));

    if (!scheme) {
      return NextResponse.json({ error: 'Security scheme not found' }, { status: 404 });
    }

    // Get max sort order
    const existingLevels = await db
      .select({ sortOrder: issueSecurityLevels.sortOrder })
      .from(issueSecurityLevels)
      .where(eq(issueSecurityLevels.schemeId, schemeId))
      .orderBy(issueSecurityLevels.sortOrder);

    const maxSortOrder = existingLevels.length > 0 
      ? Math.max(...existingLevels.map(l => l.sortOrder)) 
      : -1;

    // If setting as default, unset other defaults
    if (isDefault) {
      await db
        .update(issueSecurityLevels)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(issueSecurityLevels.schemeId, schemeId));
    }

    const [level] = await db
      .insert(issueSecurityLevels)
      .values({
        schemeId,
        name,
        description: description || null,
        sortOrder: maxSortOrder + 1,
        isDefault: isDefault || false,
      })
      .returning();

    if (!level) {
      throw new Error('Failed to create security level');
    }

    // Add members
    if (members && Array.isArray(members)) {
      for (const member of members) {
        await db.insert(issueSecurityLevelMembers).values({
          levelId: level.id,
          memberType: member.type,
          memberValue: member.value || null,
        });
      }
    }

    // Fetch level with members
    const levelMembers = await db
      .select()
      .from(issueSecurityLevelMembers)
      .where(eq(issueSecurityLevelMembers.levelId, level.id));

    return NextResponse.json({ ...level, members: levelMembers }, { status: 201 });
  } catch (error) {
    console.error('Error creating security level:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

