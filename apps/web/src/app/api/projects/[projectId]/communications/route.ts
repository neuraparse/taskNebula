import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createAuditLog, db, eq, projects } from '@tasknebula/db';
import {
  ChatAccessError,
  getProjectChatContext,
  resolveProjectIdOrThrow,
} from '@/lib/chat/server';
import { normalizeProjectCommunicationsSettings } from '@/lib/chat/config';

const projectCommunicationsSchema = z.object({
  enabled: z.boolean().optional(),
  inheritWorkspaceDefaults: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  issueThreadsEnabled: z.boolean().optional(),
  documentThreadsEnabled: z.boolean().optional(),
  attachmentsEnabled: z.boolean().optional(),
  unreadTrackingEnabled: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId } = await params;
    const context = await getProjectChatContext(session.user.id, projectId);
    if (!context.permissions.canBrowseProject) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    return NextResponse.json({
      project: {
        id: context.project.id,
        key: context.project.key,
        name: context.project.name,
      },
      access: {
        canView: context.permissions.canBrowseProject,
        canManage: context.canManageSettings,
      },
      workspaceSettings: context.workspaceSettings,
      projectSettings: context.projectSettings,
      effectiveSettings: context.effectiveSettings,
    });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load project communications settings:', error);
    return NextResponse.json({ error: 'Failed to load project communications settings' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId } = await params;
    const context = await getProjectChatContext(session.user.id, projectId);
    if (!context.canManageSettings) {
      return NextResponse.json({ error: 'You do not have permission to manage chat and calls in this project' }, { status: 403 });
    }

    const payload = projectCommunicationsSchema.parse(await request.json());
    const projectIdResolved = await resolveProjectIdOrThrow(projectId);
    const [project] = await db
      .select({ settings: projects.settings })
      .from(projects)
      .where(eq(projects.id, projectIdResolved))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const current = normalizeProjectCommunicationsSettings(
      (project.settings as Record<string, unknown> | null)?.communications
    );
    const next = normalizeProjectCommunicationsSettings({
      ...current,
      ...payload,
    });

    await db
      .update(projects)
      .set({
        settings: {
          ...((project.settings as Record<string, unknown>) || {}),
          communications: next,
        },
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(projects.id, projectIdResolved));

    await createAuditLog({
      userId: session.user.id,
      organizationId: context.project.organizationId,
      action: 'project.updated',
      resourceType: 'project_communications',
      resourceId: context.project.id,
      projectId: context.project.id,
      changes: {
        communications: { from: current, to: next },
      },
    });

    return NextResponse.json({
      projectSettings: next,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update project communications settings:', error);
    return NextResponse.json({ error: 'Failed to update project communications settings' }, { status: 500 });
  }
}
