/**
 * Just-in-time SAML user provisioning.
 *
 * After a SAML response is verified and attributes resolved, this module
 * ensures we have a TaskNebula user + organization membership for the
 * incoming subject. It is also reused by SCIM `POST /Users`.
 */
import { db, users, organizationMembers, eq, and } from '@tasknebula/db';

export type JitInput = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  workspaceId: string;
  /**
   * If the IdP sends groups in the assertion we record them on the user
   * settings blob — full group→role mapping is out of scope for the
   * scaffolding milestone but the data is preserved.
   */
  groups?: string[];
};

export type JitResult = {
  userId: string;
  created: boolean;
  membershipCreated: boolean;
};

function displayName(input: JitInput): string {
  const parts = [input.firstName, input.lastName].filter(
    (s): s is string => !!s && s.length > 0
  );
  if (parts.length) return parts.join(' ');
  return input.email.split('@')[0] ?? input.email;
}

/**
 * Find or create a user by email, and ensure they are a member of the given
 * workspace. Returns the resolved user id plus boolean flags so callers can
 * audit-log appropriately.
 */
export async function jitProvisionUser(input: JitInput): Promise<JitResult> {
  const email = input.email.trim().toLowerCase();

  // 1. Resolve or create the user row.
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  let userId: string;
  let created = false;
  if (existing) {
    userId = existing.id;
    // Update name fields if we currently have nothing.
    if (!existing.name) {
      await db
        .update(users)
        .set({ name: displayName(input), updatedAt: new Date() })
        .where(eq(users.id, existing.id));
    }
  } else {
    const insertedRows = await db
      .insert(users)
      .values({
        email,
        name: displayName(input),
        emailVerified: new Date(),
        status: 'active',
        settings: input.groups?.length
          ? ({ ssoGroups: input.groups } as Record<string, unknown>)
          : {},
      })
      .returning({ id: users.id });
    const inserted = insertedRows[0];
    if (!inserted) {
      throw new Error('Failed to provision user');
    }
    userId = inserted.id;
    created = true;
  }

  // 2. Ensure membership in the workspace.
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, input.workspaceId)
    ),
  });

  let membershipCreated = false;
  if (!member) {
    await db.insert(organizationMembers).values({
      userId,
      organizationId: input.workspaceId,
      role: 'member',
      status: 'active',
    });
    membershipCreated = true;
  }

  return { userId, created, membershipCreated };
}
