/**
 * SCIM 2.0 Group helpers — backed by the existing `teams` + `team_members`
 * tables. Each team in a workspace is exposed as one SCIM Group.
 *
 * The mapping is intentionally minimal: SCIM `displayName` ↔ `teams.name`,
 * SCIM `members[].value` ↔ `team_members.userId`. Group descriptions /
 * external metadata are left untouched.
 */
import {
  db,
  teams,
  teamMembers,
  organizationMembers,
  eq,
  and,
  inArray,
} from '@tasknebula/db';
import { SCIM_SCHEMAS, type ScimGroupRecord } from './types';
import { getBaseUrl } from '../sso/saml';

export type WorkspaceGroup = {
  id: string;
  name: string;
  memberIds: string[];
};

async function teamsForWorkspace(workspaceId: string) {
  return db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.organizationId, workspaceId));
}

async function membersFor(teamIds: string[]) {
  if (!teamIds.length) return [] as { teamId: string; userId: string }[];
  return db
    .select({ teamId: teamMembers.teamId, userId: teamMembers.userId })
    .from(teamMembers)
    .where(inArray(teamMembers.teamId, teamIds));
}

export async function listWorkspaceGroups(
  workspaceId: string,
  options: { startIndex: number; count: number }
): Promise<{ rows: WorkspaceGroup[]; total: number }> {
  const allTeams = await teamsForWorkspace(workspaceId);
  const ids = allTeams.map((t) => t.id);
  const allMembers = await membersFor(ids);
  const memberMap = new Map<string, string[]>();
  for (const m of allMembers) {
    const list = memberMap.get(m.teamId) ?? [];
    list.push(m.userId);
    memberMap.set(m.teamId, list);
  }
  const rows = allTeams.map<WorkspaceGroup>((t) => ({
    id: t.id,
    name: t.name,
    memberIds: memberMap.get(t.id) ?? [],
  }));
  const startIndex = Math.max(1, options.startIndex);
  const count = Math.min(200, Math.max(0, options.count));
  return {
    total: rows.length,
    rows: rows.slice(startIndex - 1, startIndex - 1 + count),
  };
}

export async function getWorkspaceGroup(
  workspaceId: string,
  groupId: string
): Promise<WorkspaceGroup | null> {
  const [team] = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(and(eq(teams.id, groupId), eq(teams.organizationId, workspaceId)))
    .limit(1);
  if (!team) return null;
  const members = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, team.id));
  return {
    id: team.id,
    name: team.name,
    memberIds: members.map((m) => m.userId),
  };
}

export function toScimGroup(row: WorkspaceGroup): ScimGroupRecord {
  return {
    schemas: [SCIM_SCHEMAS.group],
    id: row.id,
    displayName: row.name,
    members: row.memberIds.map((id) => ({ value: id, type: 'User' })),
    meta: {
      resourceType: 'Group',
      location: `${getBaseUrl()}/api/scim/v2/Groups/${row.id}`,
    },
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'team';
}

export async function createWorkspaceGroup(
  workspaceId: string,
  displayName: string,
  memberIds: string[]
): Promise<WorkspaceGroup> {
  const inserted = await db
    .insert(teams)
    .values({
      organizationId: workspaceId,
      name: displayName,
      slug: `${slugify(displayName)}-${Date.now().toString(36)}`,
    })
    .returning({ id: teams.id, name: teams.name });
  const team = inserted[0];
  if (!team) {
    throw new Error('Failed to create group');
  }

  if (memberIds.length) {
    await applyGroupMembershipChanges(workspaceId, team.id, {
      add: memberIds,
    });
  }
  return { id: team.id, name: team.name, memberIds };
}

export async function renameWorkspaceGroup(
  workspaceId: string,
  groupId: string,
  displayName: string
): Promise<void> {
  await db
    .update(teams)
    .set({ name: displayName, updatedAt: new Date() })
    .where(and(eq(teams.id, groupId), eq(teams.organizationId, workspaceId)));
}

export async function deleteWorkspaceGroup(
  workspaceId: string,
  groupId: string
): Promise<void> {
  await db
    .delete(teams)
    .where(and(eq(teams.id, groupId), eq(teams.organizationId, workspaceId)));
}

/**
 * Apply add / remove / replace membership changes for a group. `add` and
 * `remove` are additive; `replace` overrides any other set in this call.
 *
 * We silently skip member IDs that aren't members of the workspace — this
 * keeps the response well-formed when IdPs over-eagerly include users that
 * haven't been synced yet.
 */
export async function applyGroupMembershipChanges(
  workspaceId: string,
  groupId: string,
  changes: { add?: string[]; remove?: string[]; replace?: string[] }
): Promise<void> {
  const candidate = Array.from(
    new Set([
      ...(changes.add ?? []),
      ...(changes.remove ?? []),
      ...(changes.replace ?? []),
    ])
  );
  if (!candidate.length && !changes.replace) return;

  // Validate which candidates actually belong to the workspace.
  const validMembers = candidate.length
    ? await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, workspaceId),
            inArray(organizationMembers.userId, candidate)
          )
        )
    : [];
  const validSet = new Set(validMembers.map((r) => r.userId));

  if (changes.replace) {
    await db.delete(teamMembers).where(eq(teamMembers.teamId, groupId));
    const adds = changes.replace.filter((id) => validSet.has(id));
    if (adds.length) {
      await db.insert(teamMembers).values(
        adds.map((userId) => ({ teamId: groupId, userId, role: 'member' as const }))
      );
    }
    return;
  }
  if (changes.remove?.length) {
    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, groupId),
          inArray(teamMembers.userId, changes.remove)
        )
      );
  }
  if (changes.add?.length) {
    const adds = changes.add.filter((id) => validSet.has(id));
    for (const userId of adds) {
      // Drizzle doesn't have a built-in upsert without onConflict here, so
      // catch unique-violation per row. Memberships are rare PATCH events.
      try {
        // eslint-disable-next-line no-await-in-loop
        await db
          .insert(teamMembers)
          .values({ teamId: groupId, userId, role: 'member' });
      } catch {
        // ignore duplicates
      }
    }
  }
}
