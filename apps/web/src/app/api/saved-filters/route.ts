import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, savedFilters } from '@tasknebula/db';
import { eq, and, or, desc, isNull } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSavedFilterSchema = z.object({
  organizationId: z.string(),
  projectId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  query: z.string().min(1),
  criteria: z.record(z.any()),
  isPublic: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  viewType: z.enum(['list', 'board', 'timeline']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * GET /api/saved-filters?organizationId=xxx&projectId=xxx&includePublic=true
 * 
 * Get saved filters for current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const projectId = searchParams.get('projectId');
    const includePublic = searchParams.get('includePublic') === 'true';

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Build conditions
    const conditions: any[] = [eq(savedFilters.organizationId, organizationId)];

    if (projectId) {
      conditions.push(
        or(
          eq(savedFilters.projectId, projectId),
          isNull(savedFilters.projectId) // Include org-wide filters
        )
      );
    }

    // Include user's own filters and public filters
    if (includePublic) {
      conditions.push(
        or(
          eq(savedFilters.userId, session.user.id),
          eq(savedFilters.isPublic, true)
        )
      );
    } else {
      conditions.push(eq(savedFilters.userId, session.user.id));
    }

    const filters = await db
      .select()
      .from(savedFilters)
      .where(and(...conditions))
      .orderBy(desc(savedFilters.isStarred), desc(savedFilters.lastUsedAt));

    return NextResponse.json({ filters });
  } catch (error) {
    console.error('Get saved filters error:', error);
    return NextResponse.json(
      { error: 'Failed to get saved filters' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/saved-filters
 * 
 * Create a new saved filter
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createSavedFilterSchema.parse(body);

    const [newFilter] = await db
      .insert(savedFilters)
      .values({
        userId: session.user.id,
        organizationId: validatedData.organizationId,
        projectId: validatedData.projectId || null,
        name: validatedData.name,
        description: validatedData.description || null,
        query: validatedData.query,
        criteria: validatedData.criteria as any,
        isPublic: validatedData.isPublic || false,
        isStarred: validatedData.isStarred || false,
        viewType: validatedData.viewType || 'list',
        sortBy: validatedData.sortBy || 'created_at',
        sortOrder: validatedData.sortOrder || 'desc',
        usageCount: '0',
      })
      .returning();

    return NextResponse.json({ filter: newFilter });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create saved filter error:', error);
    return NextResponse.json(
      { error: 'Failed to create saved filter' },
      { status: 500 }
    );
  }
}

