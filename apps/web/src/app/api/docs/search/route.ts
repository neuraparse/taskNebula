import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  and,
  db,
  documentPages,
  documentSpaces,
  eq,
  inArray,
  sql,
} from '@tasknebula/db';
import {
  listAccessibleDocumentSpaces,
  resolveOrganizationIdForUser,
  resolveProjectId,
} from '@/lib/docs/server';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';
    const organizationId = await resolveOrganizationIdForUser(session.user.id, searchParams.get('organizationId'));
    const resolvedProjectId = searchParams.get('projectId')
      ? await resolveProjectId(searchParams.get('projectId')!)
      : null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!organizationId) {
      return NextResponse.json({ results: [] });
    }

    const spaces = await listAccessibleDocumentSpaces(session.user.id, organizationId, resolvedProjectId);
    const accessibleSpaceIds = spaces.map((space) => space.id);

    if (accessibleSpaceIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const searchVector = sql`to_tsvector('simple', coalesce(${documentPages.title}, '') || ' ' || coalesce(${documentPages.contentText}, ''))`;
    const searchQuery = sql`websearch_to_tsquery('simple', ${query})`;

    const results = query
      ? await db
          .select({
            id: documentPages.id,
            title: documentPages.title,
            slug: documentPages.slug,
            icon: documentPages.icon,
            excerpt: documentPages.excerpt,
            projectId: documentPages.projectId,
            spaceId: documentPages.spaceId,
            updatedAt: documentPages.updatedAt,
            rank: sql<number>`ts_rank(${searchVector}, ${searchQuery})`,
            spaceName: documentSpaces.name,
          })
          .from(documentPages)
          .innerJoin(documentSpaces, eq(documentPages.spaceId, documentSpaces.id))
          .where(
            and(
              inArray(documentPages.spaceId, accessibleSpaceIds),
              eq(documentPages.isArchived, false),
              sql`${searchVector} @@ ${searchQuery}`
            )
          )
          .orderBy(sql`ts_rank(${searchVector}, ${searchQuery}) desc`, sql`${documentPages.updatedAt} desc`)
          .limit(limit)
      : await db
          .select({
            id: documentPages.id,
            title: documentPages.title,
            slug: documentPages.slug,
            icon: documentPages.icon,
            excerpt: documentPages.excerpt,
            projectId: documentPages.projectId,
            spaceId: documentPages.spaceId,
            updatedAt: documentPages.updatedAt,
            rank: sql<number>`0`,
            spaceName: documentSpaces.name,
          })
          .from(documentPages)
          .innerJoin(documentSpaces, eq(documentPages.spaceId, documentSpaces.id))
          .where(
            and(
              inArray(documentPages.spaceId, accessibleSpaceIds),
              eq(documentPages.isArchived, false)
            )
          )
          .orderBy(sql`${documentPages.updatedAt} desc`)
          .limit(limit);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching docs:', error);
    return NextResponse.json({ error: 'Failed to search docs' }, { status: 500 });
  }
}
