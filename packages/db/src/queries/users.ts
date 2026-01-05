import { eq } from 'drizzle-orm';
import { db } from '../client';
import { users, organizationMembers, teamMembers } from '../schema';

// Get user by ID
export async function getUserById(userId: string) {
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] || null;
}

// Get user by email
export async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] || null;
}

// Get user's organizations
export async function getUserOrganizations(userId: string) {
  const result = await db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));

  return result;
}

// Get user's teams
export async function getUserTeams(userId: string) {
  const result = await db
    .select({
      teamId: teamMembers.teamId,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));

  return result;
}

// Update user
export async function updateUser(userId: string, data: Partial<typeof users.$inferInsert>) {
  const result = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  return result[0];
}

