/**
 * SCIM 2.0 User helpers — DB lookups + record shaping.
 *
 * Users live in the shared `users` table; SCIM-visible status comes from
 * `organization_members.status` (active vs. inactive) for the workspace the
 * IdP is provisioning into.
 */
import {
  db,
  users,
  organizationMembers,
  eq,
  and,
} from '@tasknebula/db';
import { SCIM_SCHEMAS, type ScimUserRecord } from './types';
import { getBaseUrl } from '../sso/saml';

export type WorkspaceUserRow = {
  id: string;
  email: string;
  name: string | null;
  membership: { status: string };
};

export async function listWorkspaceUsers(
  workspaceId: string,
  options: { startIndex: number; count: number; userName?: string }
): Promise<{ rows: WorkspaceUserRow[]; total: number }> {
  const startIndex = Math.max(1, options.startIndex);
  const count = Math.min(200, Math.max(0, options.count));

  const baseWhere = options.userName
    ? and(
        eq(organizationMembers.organizationId, workspaceId),
        eq(users.email, options.userName.trim().toLowerCase())
      )
    : eq(organizationMembers.organizationId, workspaceId);

  // We don't paginate at the SQL level for the scaffolding pass — workspaces
  // typically have under a few thousand members, and SCIM clients request
  // counts that fit in memory. Slice in JS.
  const allRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      status: organizationMembers.status,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(baseWhere);

  const total = allRows.length;
  const pageRows = allRows.slice(startIndex - 1, startIndex - 1 + count);
  return {
    total,
    rows: pageRows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      membership: { status: r.status },
    })),
  };
}

export async function getWorkspaceUser(
  workspaceId: string,
  userId: string
): Promise<WorkspaceUserRow | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      status: organizationMembers.status,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, workspaceId),
        eq(users.id, userId)
      )
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    membership: { status: row.status },
  };
}

export function toScimUser(row: WorkspaceUserRow): ScimUserRecord {
  const [givenName, ...rest] = (row.name ?? '').split(' ');
  const familyName = rest.join(' ') || null;
  return {
    schemas: [SCIM_SCHEMAS.user],
    id: row.id,
    userName: row.email,
    name: {
      givenName: givenName || null,
      familyName,
      formatted: row.name ?? null,
    },
    displayName: row.name ?? null,
    active: row.membership.status === 'active',
    emails: [{ value: row.email, primary: true, type: 'work' }],
    meta: {
      resourceType: 'User',
      location: `${getBaseUrl()}/api/scim/v2/Users/${row.id}`,
    },
  };
}

/** Tiny `userName eq "x"` filter parser — sufficient for Okta/Entra/Google. */
export function parseUserFilter(filter: string | null): {
  userName?: string;
} {
  if (!filter) return {};
  const m = /^\s*userName\s+eq\s+["'](.+?)["']\s*$/i.exec(filter);
  if (m) return { userName: m[1] };
  // externalId — we don't store externalId yet; treat as a userName lookup
  // since Google Workspace tends to set both to the email.
  const m2 = /^\s*externalId\s+eq\s+["'](.+?)["']\s*$/i.exec(filter);
  if (m2) return { userName: m2[1] };
  return {};
}

export async function setMembershipStatus(
  workspaceId: string,
  userId: string,
  status: 'active' | 'inactive'
): Promise<void> {
  await db
    .update(organizationMembers)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(organizationMembers.organizationId, workspaceId),
        eq(organizationMembers.userId, userId)
      )
    );
}

export async function updateUserCore(
  userId: string,
  patch: { name?: string | null; email?: string }
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.email) update.email = patch.email.trim().toLowerCase();
  if (Object.keys(update).length === 1) return;
  await db.update(users).set(update).where(eq(users.id, userId));
}
