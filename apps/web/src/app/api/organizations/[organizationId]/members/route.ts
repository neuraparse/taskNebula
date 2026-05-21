import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  db,
  users,
  organizationMembers,
  organizations,
  auditLogs,
  projects,
  projectMembers,
} from '@tasknebula/db';
import { eq, and, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { createHash, randomBytes } from 'crypto';
import { hasPermission, getUserRole } from '@/lib/auth/permissions';
import { publishEvent } from '@/lib/realtime/events';
import { sendEmail } from '@/lib/email/sender';
import { renderInvitationMessage } from '@/lib/email/templates';

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

    // Get all members of the organization with role.
    // `isAgent` / `agentProvider` are exposed so the UI can render virtual
    // agent users (claude/cursor/devin/copilot) differently and show the
    // Agent Activity panel when one is the assignee — see P0-04.
    const members = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        status: users.status,
        isAgent: users.isAgent,
        agentProvider: users.agentProvider,
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
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

// POST /api/organizations/[organizationId]/members - Invite member
const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer', 'guest']).default('member'),
  projectIds: z.array(z.string()).optional().default([]),
  projectRole: z
    .enum([
      'product_owner',
      'scrum_master',
      'tech_lead',
      'developer',
      'qa_engineer',
      'designer',
      'viewer',
    ])
    .default('developer'),
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
    const inviteToken = randomBytes(32).toString('base64url');
    const inviteTokenHash = createHash('sha256').update(inviteToken).digest('hex');
    const inviteTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Find or create user
    let [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (!user) {
      // Create invited user
      [user] = await db
        .insert(users)
        .values({
          id: createId(),
          email: data.email,
          name: data.email.split('@')[0],
          status: 'invited',
          inviteTokenHash,
          inviteTokenExpiresAt,
        })
        .returning();
    } else if (user.status === 'invited' && !user.password) {
      [user] = await db
        .update(users)
        .set({
          inviteTokenHash,
          inviteTokenExpiresAt,
        })
        .where(eq(users.id, user.id))
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

    // Optional: assign user to projects. Skip silently on errors — do not 500 the invite.
    const addedToProjects: string[] = [];
    const skippedProjects: string[] = [];
    const addedProjectNames: string[] = [];

    if (data.projectIds.length > 0) {
      // Determine if caller broadly has project:manage for the org.
      const canManageProjects = await hasPermission(organizationId, 'project:manage');
      const projectsInOrg = await db
        .select({
          id: projects.id,
          name: projects.name,
          leadId: projects.leadId,
        })
        .from(projects)
        .where(
          and(inArray(projects.id, data.projectIds), eq(projects.organizationId, organizationId))
        );
      const validProjectById = new Map(projectsInOrg.map((project) => [project.id, project]));
      const existingProjectMembers =
        projectsInOrg.length > 0
          ? await db
              .select({
                projectId: projectMembers.projectId,
                userId: projectMembers.userId,
              })
              .from(projectMembers)
              .where(
                and(
                  inArray(
                    projectMembers.projectId,
                    projectsInOrg.map((project) => project.id)
                  ),
                  eq(projectMembers.userId, user.id)
                )
              )
          : [];
      const existingProjectIds = new Set(existingProjectMembers.map((member) => member.projectId));

      for (const projectId of data.projectIds) {
        try {
          const project = validProjectById.get(projectId);
          if (!project) {
            // Silently skip missing / cross-org projects.
            skippedProjects.push(projectId);
            continue;
          }

          // Permission gate: either has org-wide project:manage, or is the project lead.
          const isLead = project.leadId === session.user.id;
          if (!canManageProjects && !isLead) {
            skippedProjects.push(projectId);
            continue;
          }

          if (existingProjectIds.has(projectId)) {
            skippedProjects.push(projectId);
            continue;
          }

          await db.insert(projectMembers).values({
            id: createId(),
            projectId,
            userId: user.id,
            role: data.projectRole,
            canManageSprints: 'false',
            canStartSprint: 'false',
            canAssignIssues: 'false',
            invitedBy: session.user.id,
          });

          await db.insert(auditLogs).values({
            id: createId(),
            organizationId,
            userId: session.user.id,
            action: 'organization.member_added_to_project',
            resourceType: 'project_member',
            resourceId: projectId,
            metadata: {
              projectId,
              role: data.projectRole,
            },
          });

          addedToProjects.push(projectId);
          addedProjectNames.push(project.name);
        } catch (err) {
          console.error('Project assignment error for', projectId, err);
          skippedProjects.push(projectId);
        }
      }
    }

    // Send invite email (fire-and-forget) — uses shared renderShell + sendEmail
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    const [inviter] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const orgName = org?.name || 'their organization';
    const inviterName = inviter?.name || 'A team member';
    const signupUrl =
      user.status === 'invited'
        ? `${appUrl}/auth/signup?email=${encodeURIComponent(data.email)}&token=${encodeURIComponent(inviteToken)}`
        : `${appUrl}/auth/signin?email=${encodeURIComponent(data.email)}`;

    const { subject, html, text } = renderInvitationMessage({
      inviteeEmail: data.email,
      inviterName,
      orgName,
      role: data.role,
      addedProjectNames,
      signupUrl,
    });

    sendEmail({
      to: data.email,
      subject,
      html,
      text,
    })
      .then((result) => {
        if (result.sent) {
          console.log('Invite email sent to:', data.email, result.messageId);
        } else if (result.skipped) {
          console.log('Invite email skipped (SMTP not configured) for:', data.email);
        } else if (result.error) {
          console.error('Invite email error:', result.error);
        }
      })
      .catch((err) =>
        console.error('Invite email error:', err instanceof Error ? err.message : err)
      );

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
      addedToProjects,
      skippedProjects,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error inviting member:', error);
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 });
  }
}
