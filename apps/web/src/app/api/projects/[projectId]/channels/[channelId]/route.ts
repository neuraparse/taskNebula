import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { and, createAuditLog, db, eq, projectChannels } from '@tasknebula/db';
import { ChatAccessError, getChannelWithRoom, getProjectChatContext } from '@/lib/chat/server';

const updateChannelSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  isArchived: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; channelId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId, channelId } = await params;
    const context = await getProjectChatContext(session.user.id, projectId);
    if (!context.permissions.canCreateChannels) {
      return NextResponse.json({ error: 'You do not have permission to edit channels' }, { status: 403 });
    }

    const body = await request.json();
    const data = updateChannelSchema.parse(body);
    const [channel] = await db
      .update(projectChannels)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isArchived !== undefined ? { isArchived: data.isArchived } : {}),
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(and(eq(projectChannels.id, channelId), eq(projectChannels.projectId, context.project.id)))
      .returning();

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    await createAuditLog({
      userId: session.user.id,
      organizationId: context.project.organizationId,
      action: data.isArchived ? 'chat.channel_deleted' : 'chat.channel_updated',
      resourceType: 'project_channel',
      resourceId: channel.id,
      projectId: context.project.id,
      metadata: { isArchived: channel.isArchived },
    });

    const payload = await getChannelWithRoom(channel.id);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update channel:', error);
    return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; channelId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId, channelId } = await params;
    const context = await getProjectChatContext(session.user.id, projectId);
    if (!context.permissions.canCreateChannels) {
      return NextResponse.json({ error: 'You do not have permission to archive channels' }, { status: 403 });
    }

    const [channel] = await db
      .update(projectChannels)
      .set({
        isArchived: true,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(and(eq(projectChannels.id, channelId), eq(projectChannels.projectId, context.project.id)))
      .returning();

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    await createAuditLog({
      userId: session.user.id,
      organizationId: context.project.organizationId,
      action: 'chat.channel_deleted',
      resourceType: 'project_channel',
      resourceId: channel.id,
      projectId: context.project.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to archive channel:', error);
    return NextResponse.json({ error: 'Failed to archive channel' }, { status: 500 });
  }
}
