import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  and,
  conversationRooms,
  createAuditLog,
  db,
  desc,
  eq,
  projectChannels,
} from '@tasknebula/db';
import { createId } from '@paralleldrive/cuid2';
import { ChatAccessError, ensureDefaultProjectChannels, getProjectChatContext } from '@/lib/chat/server';

const createChannelSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
});

function slugifyChannel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'channel';
}

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
    if (!context.canView) {
      return NextResponse.json({ error: 'You do not have access to project chat' }, { status: 403 });
    }

    const channels = await ensureDefaultProjectChannels({
      projectId: context.project.id,
      organizationId: context.project.organizationId,
      userId: session.user.id,
    });

    const rooms = await db
      .select()
      .from(conversationRooms)
      .where(eq(conversationRooms.projectId, context.project.id));
    const roomByChannelId = new Map(
      rooms.filter((room) => room.channelId).map((room) => [room.channelId as string, room.id])
    );

    return NextResponse.json({
      channels: channels.map((channel) => ({
        ...channel,
        roomId: roomByChannelId.get(channel.id) || null,
      })),
    });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load project channels:', error);
    return NextResponse.json({ error: 'Failed to load project channels' }, { status: 500 });
  }
}

export async function POST(
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
    if (!context.permissions.canCreateChannels) {
      return NextResponse.json({ error: 'You do not have permission to create channels' }, { status: 403 });
    }

    if (!context.effectiveSettings.enabled) {
      return NextResponse.json({ error: 'Chat is disabled in this project' }, { status: 409 });
    }

    const body = await request.json();
    const data = createChannelSchema.parse(body);
    const slugBase = slugifyChannel(data.name);
    let slug = slugBase;
    let suffix = 1;

    while (true) {
      const [existing] = await db
        .select({ id: projectChannels.id })
        .from(projectChannels)
        .where(and(eq(projectChannels.projectId, context.project.id), eq(projectChannels.slug, slug)))
        .limit(1);

      if (!existing) {
        break;
      }

      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    const [lastChannel] = await db
      .select({ position: projectChannels.position })
      .from(projectChannels)
      .where(eq(projectChannels.projectId, context.project.id))
      .orderBy(desc(projectChannels.position))
      .limit(1);

    const position = typeof lastChannel?.position === 'number' ? lastChannel.position + 1 : 0;

    const [channel] = await db
      .insert(projectChannels)
      .values({
        id: createId(),
        organizationId: context.project.organizationId,
        projectId: context.project.id,
        name: data.name,
        slug,
        description: data.description || null,
        isDefault: false,
        position,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    if (!channel) {
      return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 });
    }

    const [room] = await db
      .insert(conversationRooms)
      .values({
        id: createId(),
        organizationId: context.project.organizationId,
        projectId: context.project.id,
        kind: 'channel',
        channelId: channel.id,
        title: `#${channel.slug}`,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    await createAuditLog({
      userId: session.user.id,
      organizationId: context.project.organizationId,
      action: 'chat.channel_created',
      resourceType: 'project_channel',
      resourceId: channel.id,
      projectId: context.project.id,
      metadata: { roomId: room?.id || null, slug: channel.slug },
    });

    return NextResponse.json({ channel, room }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create project channel:', error);
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 });
  }
}
