import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, users, organizationMembers, organizations, auditLogs, sendEmail } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { hasPermission, getUserRole } from '@/lib/auth/permissions';
import { publishEvent } from '@/lib/realtime/events';

// GET /api/organizations/[organizationId]/members - List members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;

    // Check permission to view members
    const canView = await hasPermission(organizationId, 'member:view');
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get all members of the organization with role
    const members = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        status: users.status,
        role: organizationMembers.role,
        memberStatus: organizationMembers.status,
        joinedAt: organizationMembers.createdAt,
      })
      .from(users)
      .innerJoin(organizationMembers, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, organizationId));

    // Get current user's role
    const userRole = await getUserRole(organizationId);

    return NextResponse.json({
      members,
      userRole: userRole?.role || null,
      isSuperAdmin: userRole?.isSuperAdmin || false,
    });
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

// POST /api/organizations/[organizationId]/members - Invite member
const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer', 'guest']).default('member'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;

    // Check permission
    const canInvite = await hasPermission(organizationId, 'member:invite');
    if (!canInvite) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const data = inviteMemberSchema.parse(body);

    // Find or create user
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (!user) {
      // Create invited user
      [user] = await db
        .insert(users)
        .values({
          id: createId(),
          email: data.email,
          name: data.email.split('@')[0],
          status: 'invited',
        })
        .returning();
    }

    if (!user) {
      throw new Error('Failed to find or create user');
    }

    // Check if already a member
    const [existingMember] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, user.id)
        )
      )
      .limit(1);

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
    }

    // Add member
    const [newMember] = await db
      .insert(organizationMembers)
      .values({
        id: createId(),
        organizationId,
        userId: user.id,
        role: data.role,
        status: user.status === 'invited' ? 'invited' : 'active',
      })
      .returning();

    if (!newMember) {
      throw new Error('Failed to add member');
    }

    // Create audit log
    await db.insert(auditLogs).values({
      id: createId(),
      organizationId,
      userId: session.user.id,
      action: 'organization.member_added',
      resourceType: 'organization_member',
      resourceId: newMember.id,
      metadata: {
        invitedEmail: data.email,
        role: data.role,
      },
    });

    publishEvent('member.added', session.user.id, { organizationId });

    // Send invite email (fire-and-forget)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    const [inviter] = await db.select({ name: users.name }).from(users).where(eq(users.id, session.user.id)).limit(1);

    import('nodemailer').then(async (nodemailer) => {
      const host = process.env.SMTP_HOST;
      if (!host) return;
      const transport = nodemailer.default.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '25'),
        secure: process.env.SMTP_SECURE === 'true',
        tls: { rejectUnauthorized: false },
      });
      await transport.sendMail({
        from: process.env.EMAIL_FROM || 'TaskNebula <noreply@localhost>',
        to: data.email,
        subject: `You've been invited to ${org?.name || 'an organization'} on TaskNebula`,
        html: `<h2>You're invited!</h2>
<p><strong>${inviter?.name || 'A team member'}</strong> has invited you to join <strong>${org?.name || 'their organization'}</strong> on TaskNebula.</p>
<p><a href="${appUrl}/auth/signup" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Accept Invitation</a></p>
<p style="color:#666;font-size:13px;">Create your account with <strong>${data.email}</strong> to get started.</p>`,
        text: `${inviter?.name || 'A team member'} invited you to ${org?.name || 'their organization'} on TaskNebula. Create your account at ${appUrl}/auth/signup`,
      });
      console.log('📧 Invite email sent to:', data.email);
    }).catch(err => console.error('Invite email error:', err.message));

    return NextResponse.json({
      member: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        status: user.status,
        role: newMember.role,
        memberStatus: newMember.status,
        joinedAt: newMember.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error inviting member:', error);
    return NextResponse.json(
      { error: 'Failed to invite member' },
      { status: 500 }
    );
  }
}

