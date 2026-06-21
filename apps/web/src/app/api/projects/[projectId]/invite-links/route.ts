import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import {
  auditLogs,
  db,
  desc,
  eq,
  projectInviteLinks,
  users,
  type ProjectRole,
} from '@tasknebula/db';
import { auth } from '@/auth';
import {
  buildProjectInviteUrl,
  clampProjectInviteExpiresInDays,
  clampProjectInviteMaxUses,
  createProjectInviteToken,
  hashProjectInviteToken,
  PROJECT_INVITE_LINK_MAX_EXPIRES_IN_DAYS,
  PROJECT_INVITE_LINK_MAX_USES,
} from '@/lib/invitations/project-invite-links';
import { canManageProjectMembers } from '@/lib/projects/member-access';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

const DAY_MS = 24 * 60 * 60 * 1000;

const projectRoleSchema = z.enum([
  'product_owner',
  'scrum_master',
  'tech_lead',
  'developer',
  'qa_engineer',
  'designer',
  'viewer',
]);

const createInviteLinkSchema = z.object({
  role: projectRoleSchema.default('developer'),
  expiresInDays: z.number().int().min(1).max(PROJECT_INVITE_LINK_MAX_EXPIRES_IN_DAYS).optional(),
  maxUses: z.number().int().min(1).max(PROJECT_INVITE_LINK_MAX_USES).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdOrKey } = await params;
    const project = await resolveProjectByIdOrKey(projectIdOrKey, session.user.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const canManage = await canManageProjectMembers(session.user.id, project.id);
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const links = await db
      .select({
        id: projectInviteLinks.id,
        role: projectInviteLinks.role,
        maxUses: projectInviteLinks.maxUses,
        usedCount: projectInviteLinks.usedCount,
        expiresAt: projectInviteLinks.expiresAt,
        revokedAt: projectInviteLinks.revokedAt,
        createdAt: projectInviteLinks.createdAt,
        updatedAt: projectInviteLinks.updatedAt,
        createdBy: projectInviteLinks.createdBy,
        creatorName: users.name,
        creatorEmail: users.email,
      })
      .from(projectInviteLinks)
      .leftJoin(users, eq(users.id, projectInviteLinks.createdBy))
      .where(eq(projectInviteLinks.projectId, project.id))
      .orderBy(desc(projectInviteLinks.createdAt));

    return NextResponse.json({ links });
  } catch (error) {
    console.error('Error fetching project invite links:', error);
    return NextResponse.json({ error: 'Failed to fetch invite links' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdOrKey } = await params;
    const project = await resolveProjectByIdOrKey(projectIdOrKey, session.user.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const canManage = await canManageProjectMembers(session.user.id, project.id);
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const data = createInviteLinkSchema.parse(body);
    const expiresInDays = clampProjectInviteExpiresInDays(data.expiresInDays);
    const maxUses = clampProjectInviteMaxUses(data.maxUses);
    const token = createProjectInviteToken();
    const expiresAt = new Date(Date.now() + expiresInDays * DAY_MS);

    const [link] = await db
      .insert(projectInviteLinks)
      .values({
        id: createId(),
        organizationId: project.organizationId,
        projectId: project.id,
        tokenHash: hashProjectInviteToken(token),
        role: data.role as ProjectRole,
        maxUses,
        usedCount: 0,
        expiresAt,
        createdBy: session.user.id,
      })
      .returning({
        id: projectInviteLinks.id,
        role: projectInviteLinks.role,
        maxUses: projectInviteLinks.maxUses,
        usedCount: projectInviteLinks.usedCount,
        expiresAt: projectInviteLinks.expiresAt,
        revokedAt: projectInviteLinks.revokedAt,
        createdAt: projectInviteLinks.createdAt,
        updatedAt: projectInviteLinks.updatedAt,
        createdBy: projectInviteLinks.createdBy,
      });

    if (!link) {
      throw new Error('Failed to create project invite link');
    }

    await db.insert(auditLogs).values({
      id: createId(),
      organizationId: project.organizationId,
      userId: session.user.id,
      action: 'project.invite_link_created',
      resourceType: 'project_invite_link',
      resourceId: link.id,
      metadata: {
        projectId: project.id,
        role: link.role,
        maxUses,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return NextResponse.json(
      {
        link,
        inviteUrl: buildProjectInviteUrl(token, request.nextUrl.origin),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating project invite link:', error);
    return NextResponse.json({ error: 'Failed to create invite link' }, { status: 500 });
  }
}
