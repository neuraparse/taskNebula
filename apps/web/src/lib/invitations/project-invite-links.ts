import { createHash, randomBytes } from 'crypto';
import { createId } from '@paralleldrive/cuid2';
import {
  auditLogs,
  db,
  eq,
  and,
  gt,
  isNull,
  organizations,
  organizationMembers,
  projectInviteLinks,
  projectMembers,
  projects,
  sql,
  users,
  type ProjectRole,
} from '@tasknebula/db';
import { getProjectMemberPermissionValues } from '@/lib/projects/member-permissions';
import { buildAppUrl } from '@/lib/url/app-url';

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const PROJECT_INVITE_LINK_DEFAULT_EXPIRES_IN_DAYS = 7;
export const PROJECT_INVITE_LINK_MAX_EXPIRES_IN_DAYS = 90;
export const PROJECT_INVITE_LINK_MAX_USES = 25;

export const PROJECT_INVITE_ROLES = [
  'product_owner',
  'scrum_master',
  'tech_lead',
  'developer',
  'qa_engineer',
  'designer',
  'viewer',
] as const satisfies readonly ProjectRole[];

export type ProjectInviteLinkErrorCode =
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'used_up'
  | 'project_missing';

export class ProjectInviteLinkError extends Error {
  constructor(
    readonly code: ProjectInviteLinkErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProjectInviteLinkError';
  }
}

type ProjectInviteRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  role: ProjectRole;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | string;
  revokedAt: Date | string | null;
  createdBy: string;
  projectKey: string;
  projectName: string;
  organizationName: string;
};

export type AcceptedProjectInvite = {
  projectId: string;
  projectKey: string;
  projectName: string;
  organizationId: string;
  organizationName: string;
  role: ProjectRole;
  alreadyMember: boolean;
};

export type ProjectInviteSignupResult = {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  invite: AcceptedProjectInvite;
};

export function createProjectInviteToken() {
  return randomBytes(32).toString('base64url');
}

export function hashProjectInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function buildProjectInviteUrl(token: string, origin?: string) {
  return buildAppUrl(`/join/project/${encodeURIComponent(token)}`, origin);
}

export function clampProjectInviteExpiresInDays(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return PROJECT_INVITE_LINK_DEFAULT_EXPIRES_IN_DAYS;
  return Math.min(Math.max(Math.trunc(numeric), 1), PROJECT_INVITE_LINK_MAX_EXPIRES_IN_DAYS);
}

export function clampProjectInviteMaxUses(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(Math.max(Math.trunc(numeric), 1), PROJECT_INVITE_LINK_MAX_USES);
}

export async function findProjectInviteLinkByToken(
  token: unknown,
  client: DbExecutor = db
): Promise<ProjectInviteRecord | null> {
  if (typeof token !== 'string' || !token.trim()) return null;
  const tokenHash = hashProjectInviteToken(token.trim());

  const [invite] = await client
    .select({
      id: projectInviteLinks.id,
      organizationId: projectInviteLinks.organizationId,
      projectId: projectInviteLinks.projectId,
      role: projectInviteLinks.role,
      maxUses: projectInviteLinks.maxUses,
      usedCount: projectInviteLinks.usedCount,
      expiresAt: projectInviteLinks.expiresAt,
      revokedAt: projectInviteLinks.revokedAt,
      createdBy: projectInviteLinks.createdBy,
      projectKey: projects.key,
      projectName: projects.name,
      organizationName: organizations.name,
    })
    .from(projectInviteLinks)
    .innerJoin(projects, eq(projects.id, projectInviteLinks.projectId))
    .innerJoin(organizations, eq(organizations.id, projectInviteLinks.organizationId))
    .where(eq(projectInviteLinks.tokenHash, tokenHash))
    .limit(1);

  return invite ?? null;
}

export function assertProjectInviteLinkUsable(
  invite: ProjectInviteRecord | null
): asserts invite is ProjectInviteRecord {
  if (!invite) {
    throw new ProjectInviteLinkError('invalid', 'Invalid project invitation link');
  }
  if (invite.revokedAt) {
    throw new ProjectInviteLinkError('revoked', 'Project invitation link was revoked');
  }
  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    throw new ProjectInviteLinkError('expired', 'Project invitation link has expired');
  }
  if (invite.usedCount >= invite.maxUses) {
    throw new ProjectInviteLinkError('used_up', 'Project invitation link has no remaining uses');
  }
}

export async function isProjectInviteLinkUsable(token: unknown) {
  const invite = await findProjectInviteLinkByToken(token);
  try {
    assertProjectInviteLinkUsable(invite);
    return Boolean(invite);
  } catch {
    return false;
  }
}

async function claimProjectInviteUse(tx: DbExecutor, inviteId: string) {
  const now = new Date();
  const [claimed] = await tx
    .update(projectInviteLinks)
    .set({
      usedCount: sql<number>`${projectInviteLinks.usedCount} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(projectInviteLinks.id, inviteId),
        isNull(projectInviteLinks.revokedAt),
        gt(projectInviteLinks.expiresAt, now),
        sql`${projectInviteLinks.usedCount} < ${projectInviteLinks.maxUses}`
      )
    )
    .returning({ id: projectInviteLinks.id });

  if (!claimed) {
    throw new ProjectInviteLinkError('used_up', 'Project invitation link has no remaining uses');
  }
}

async function ensureOrganizationMembership(
  tx: DbExecutor,
  organizationId: string,
  userId: string
) {
  const [existing] = await tx
    .select({ id: organizationMembers.id, status: organizationMembers.status })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

  if (!existing) {
    await tx.insert(organizationMembers).values({
      id: createId(),
      organizationId,
      userId,
      role: 'member',
      status: 'active',
    });
    return;
  }

  if (existing.status !== 'active') {
    await tx
      .update(organizationMembers)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(organizationMembers.id, existing.id));
  }
}

async function ensureProjectMembership(
  tx: DbExecutor,
  invite: ProjectInviteRecord,
  userId: string
) {
  await tx
    .insert(projectMembers)
    .values({
      id: createId(),
      projectId: invite.projectId,
      userId,
      role: invite.role,
      invitedBy: invite.createdBy,
      ...getProjectMemberPermissionValues(invite.role),
    })
    .onConflictDoNothing();
}

function toAcceptedProjectInvite(
  invite: ProjectInviteRecord,
  alreadyMember: boolean
): AcceptedProjectInvite {
  return {
    projectId: invite.projectId,
    projectKey: invite.projectKey,
    projectName: invite.projectName,
    organizationId: invite.organizationId,
    organizationName: invite.organizationName,
    role: invite.role,
    alreadyMember,
  };
}

export async function acceptProjectInviteLink({
  token,
  userId,
}: {
  token: unknown;
  userId: string;
}): Promise<AcceptedProjectInvite> {
  return db.transaction(async (tx) => {
    const invite = await findProjectInviteLinkByToken(token, tx);
    assertProjectInviteLinkUsable(invite);

    const [existingProjectMember] = await tx
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, invite.projectId), eq(projectMembers.userId, userId)))
      .limit(1);

    if (existingProjectMember) {
      await ensureOrganizationMembership(tx, invite.organizationId, userId);
      return toAcceptedProjectInvite(invite, true);
    }

    await claimProjectInviteUse(tx, invite.id);
    await ensureOrganizationMembership(tx, invite.organizationId, userId);
    await ensureProjectMembership(tx, invite, userId);

    await tx.insert(auditLogs).values({
      id: createId(),
      organizationId: invite.organizationId,
      userId,
      action: 'project.invite_link_accepted',
      resourceType: 'project_invite_link',
      resourceId: invite.id,
      metadata: {
        projectId: invite.projectId,
        role: invite.role,
      },
    });

    return toAcceptedProjectInvite(invite, false);
  });
}

export async function createUserWithProjectInviteLink({
  name,
  email,
  passwordHash,
  token,
}: {
  name: string;
  email: string;
  passwordHash: string;
  token: unknown;
}): Promise<ProjectInviteSignupResult> {
  return db.transaction(async (tx) => {
    const invite = await findProjectInviteLinkByToken(token, tx);
    assertProjectInviteLinkUsable(invite);
    await claimProjectInviteUse(tx, invite.id);

    const [newUser] = await tx
      .insert(users)
      .values({
        name,
        email,
        password: passwordHash,
        status: 'active',
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
      });

    if (!newUser) {
      throw new Error('Failed to create invited user');
    }

    await ensureOrganizationMembership(tx, invite.organizationId, newUser.id);
    await ensureProjectMembership(tx, invite, newUser.id);

    await tx.insert(auditLogs).values({
      id: createId(),
      organizationId: invite.organizationId,
      userId: newUser.id,
      action: 'project.invite_link_signup',
      resourceType: 'project_invite_link',
      resourceId: invite.id,
      metadata: {
        projectId: invite.projectId,
        role: invite.role,
        email,
      },
    });

    return {
      user: newUser,
      invite: toAcceptedProjectInvite(invite, false),
    };
  });
}
