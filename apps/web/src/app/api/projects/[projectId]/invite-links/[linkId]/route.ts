import { NextRequest, NextResponse } from 'next/server';
import { createId } from '@paralleldrive/cuid2';
import { auditLogs, db, eq, and, projectInviteLinks } from '@tasknebula/db';
import { auth } from '@/auth';
import { canManageProjectMembers } from '@/lib/projects/member-access';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; linkId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdOrKey, linkId } = await params;
    const project = await resolveProjectByIdOrKey(projectIdOrKey, session.user.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const canManage = await canManageProjectMembers(session.user.id, project.id);
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const now = new Date();
    const [link] = await db
      .update(projectInviteLinks)
      .set({
        revokedAt: now,
        revokedBy: session.user.id,
        updatedAt: now,
      })
      .where(and(eq(projectInviteLinks.id, linkId), eq(projectInviteLinks.projectId, project.id)))
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
      return NextResponse.json({ error: 'Invite link not found' }, { status: 404 });
    }

    await db.insert(auditLogs).values({
      id: createId(),
      organizationId: project.organizationId,
      userId: session.user.id,
      action: 'project.invite_link_revoked',
      resourceType: 'project_invite_link',
      resourceId: link.id,
      metadata: {
        projectId: project.id,
      },
    });

    return NextResponse.json({ link });
  } catch (error) {
    console.error('Error revoking project invite link:', error);
    return NextResponse.json({ error: 'Failed to revoke invite link' }, { status: 500 });
  }
}
