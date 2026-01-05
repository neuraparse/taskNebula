import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, users, organizationMembers, auditLogs } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { hasPermission } from '@/lib/auth/permissions';

// PATCH /api/organizations/[organizationId]/members/[memberId] - Update member role
const updateMemberSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer', 'guest']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, memberId } = await params;

    // Check permission
    const canUpdate = await hasPermission(organizationId, 'member.update_role');
    if (!canUpdate) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const data = updateMemberSchema.parse(body);

    // Get current member
    const [currentMember] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, memberId)
        )
      )
      .limit(1);

    if (!currentMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent changing own role
    if (memberId === session.user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    // Update member role
    const [updatedMember] = await db
      .update(organizationMembers)
      .set({
        role: data.role,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, memberId)
        )
      )
      .returning();

    // Create audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: session.user.id,
      action: 'member.role_changed',
      resourceType: 'organization_member',
      resourceId: updatedMember.id,
      metadata: {
        memberId,
        oldRole: currentMember.role,
        newRole: data.role,
      },
    });

    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, memberId))
      .limit(1);

    return NextResponse.json({
      member: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        status: user.status,
        role: updatedMember.role,
        memberStatus: updatedMember.status,
        joinedAt: updatedMember.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[organizationId]/members/[memberId] - Remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, memberId } = await params;

    // Check permission
    const canRemove = await hasPermission(organizationId, 'member.remove');
    if (!canRemove) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Prevent removing self
    if (memberId === session.user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
    }

    // Get member
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, memberId)
        )
      )
      .limit(1);

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent removing owner
    if (member.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove organization owner' }, { status: 400 });
    }

    // Delete member
    await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, memberId)
        )
      );

    // Create audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: session.user.id,
      action: 'member.removed',
      resourceType: 'organization_member',
      resourceId: member.id,
      metadata: {
        memberId,
        role: member.role,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}

