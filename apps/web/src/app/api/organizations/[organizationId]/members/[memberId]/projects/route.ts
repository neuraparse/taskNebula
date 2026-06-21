import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  db,
  organizationMembers,
  projects,
  projectMembers,
  auditLogs,
  type ProjectRole,
} from '@tasknebula/db';
import { and, eq, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { hasPermission } from '@/lib/auth/permissions';
import { getProjectMemberPermissionValues } from '@/lib/projects/member-permissions';
import { publishEvent } from '@/lib/realtime/events';

const assignProjectsSchema = z.object({
  projectIds: z.array(z.string().min(1)).min(1).max(100),
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

// POST /api/organizations/[organizationId]/members/[memberId]/projects
// Assign an existing organization member to one or more projects in the same workspace.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, memberId } = await params;

    const canAssignProjects = await hasPermission(organizationId, 'project:manage');
    if (!canAssignProjects) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const data = assignProjectsSchema.parse(body);
    const requestedProjectIds = Array.from(new Set(data.projectIds.map((id) => id.trim()))).filter(
      Boolean
    );

    if (requestedProjectIds.length === 0) {
      return NextResponse.json({ error: 'projectIds is required' }, { status: 400 });
    }

    const [member] = await db
      .select({ id: organizationMembers.id })
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

    const projectsInOrg = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(inArray(projects.id, requestedProjectIds), eq(projects.organizationId, organizationId))
      );
    const validProjectIds = new Set(projectsInOrg.map((project) => project.id));

    const existingProjectMembers =
      projectsInOrg.length > 0
        ? await db
            .select({ projectId: projectMembers.projectId })
            .from(projectMembers)
            .where(
              and(
                inArray(
                  projectMembers.projectId,
                  projectsInOrg.map((project) => project.id)
                ),
                eq(projectMembers.userId, memberId)
              )
            )
        : [];
    const existingProjectIds = new Set(existingProjectMembers.map((row) => row.projectId));

    const addedToProjects: string[] = [];
    const skippedProjects: string[] = [];
    const projectRole = data.projectRole as ProjectRole;

    for (const projectId of requestedProjectIds) {
      if (!validProjectIds.has(projectId) || existingProjectIds.has(projectId)) {
        skippedProjects.push(projectId);
        continue;
      }

      try {
        await db.insert(projectMembers).values({
          projectId,
          userId: memberId,
          role: projectRole,
          invitedBy: session.user.id,
          ...getProjectMemberPermissionValues(projectRole),
        });
        addedToProjects.push(projectId);
      } catch (error) {
        console.error('Project assignment error for', projectId, error);
        skippedProjects.push(projectId);
      }
    }

    if (addedToProjects.length > 0) {
      await db.insert(auditLogs).values({
        id: createId(),
        organizationId,
        userId: session.user.id,
        action: 'organization.member_added_to_project',
        resourceType: 'organization_member',
        resourceId: member.id,
        metadata: {
          memberId,
          projectIds: addedToProjects,
          skippedProjectIds: skippedProjects,
          role: projectRole,
        },
      });

      publishEvent('member.added', session.user.id, { organizationId });
    }

    return NextResponse.json({ addedToProjects, skippedProjects });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error assigning member to projects:', error);
    return NextResponse.json({ error: 'Failed to assign member to projects' }, { status: 500 });
  }
}
