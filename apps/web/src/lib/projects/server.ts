import { db, projects } from '@tasknebula/db';
import { eq } from 'drizzle-orm';

export async function resolveProjectByIdOrKey(projectIdOrKey: string) {
  let [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectIdOrKey))
    .limit(1);

  if (!project) {
    [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.key, projectIdOrKey.toUpperCase()))
      .limit(1);
  }

  return project ?? null;
}
