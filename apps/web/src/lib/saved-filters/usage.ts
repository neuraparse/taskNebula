import { and, eq } from 'drizzle-orm';
import { db, savedFilters } from '@tasknebula/db';

export async function markSavedFilterUsedForUser(filterId: string, userId: string) {
  const [existing] = await db
    .select()
    .from(savedFilters)
    .where(and(eq(savedFilters.id, filterId), eq(savedFilters.userId, userId)));

  if (!existing) return null;

  const currentCount = Number.parseInt(existing.usageCount, 10);
  const nextCount = Number.isFinite(currentCount) ? currentCount + 1 : 1;

  const [updated] = await db
    .update(savedFilters)
    .set({
      usageCount: nextCount.toString(),
      lastUsedAt: new Date(),
    })
    .where(and(eq(savedFilters.id, filterId), eq(savedFilters.userId, userId)))
    .returning();

  return updated ?? null;
}
