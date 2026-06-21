// QUAL-21 TS-strict-migration: file untouched intentionally; surfaces 7 errors
// under `exactOptionalPropertyTypes`. See docs/TS_STRICT_MIGRATION.md.
import { createId } from '@paralleldrive/cuid2';
import {
  and,
  asc,
  callParticipants,
  callSessions,
  chatMessageReactions,
  chatMessages,
  conversationRooms,
  createAuditLog,
  db,
  desc,
  documentPages,
  eq,
  getIssueById,
  gt,
  inArray,
  isNull,
  ne,
  organizationMembers,
  organizations,
  projectChannels,
  projectMembers,
  projects,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission as roleHasPermission,
  type ProjectRole,
  roomReadStates,
  sql,
  users,
} from '@tasknebula/db';
import {
  buildLivekitParticipantIdentity,
  buildLivekitRoomName,
  createLivekitRoomService,
  createLivekitToken,
  getLivekitStatus,
  parseLivekitParticipantIdentity,
} from '@/lib/chat/livekit';
import { chatServerDebug, chatServerError } from '@/lib/chat/debug';
import {
  ACTIVE_CALL_HEARTBEAT_STALE_MS,
  hasFreshHeartbeatParticipants,
  resolveActiveCallParticipantCount,
  shouldAutoEndActiveCall,
} from '@/lib/chat/call-lifecycle';
import {
  normalizeProjectCommunicationsSettings,
  normalizeWorkspaceCommunicationsSettings,
  resolveEffectiveProjectCommunicationsSettings,
  type EffectiveProjectCommunicationsSettings,
  type ProjectCommunicationsSettings,
  type WorkspaceCommunicationsSettings,
} from '@/lib/chat/config';
import { listRoomPresence, publishRoomEvent } from '@/lib/chat/realtime';
import { resolveDocumentPageAccess } from '@/lib/docs/server';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

type ChatPermissionSet = {
  canBrowseProject: boolean;
  canAdministerProject: boolean;
  canBrowseChat: boolean;
  canCreateChannels: boolean;
  canPostMessages: boolean;
  canModerateMessages: boolean;
  canStartCalls: boolean;
  canManageCalls: boolean;
};

type ProjectChatContext = {
  project: typeof projects.$inferSelect;
  organization: typeof organizations.$inferSelect;
  projectRole: ProjectRole | null;
  orgRole: string | null;
  isSuperAdmin: boolean;
  isOrgOwner: boolean;
  isOrgAdmin: boolean;
  permissions: ChatPermissionSet;
  workspaceSettings: WorkspaceCommunicationsSettings;
  projectSettings: ProjectCommunicationsSettings;
  effectiveSettings: EffectiveProjectCommunicationsSettings;
  canView: boolean;
  canManageSettings: boolean;
};

type ChatMessageAttachmentRecord = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  uploadedById: string;
  uploadedAt: string;
};

type SerializedReaction = {
  emoji: string;
  count: number;
  reactedUserIds: string[];
  reactedByCurrentUser: boolean;
};

type SerializedConversationMessage = typeof chatMessages.$inferSelect & {
  mentions: string[];
  attachments: ChatMessageAttachmentRecord[];
  reactions: SerializedReaction[];
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  canDelete: boolean;
  canEdit: boolean;
  moderation: {
    deletedBody: string;
    deletedByName: string | null;
    deletedById: string | null;
    deletedAt: string;
    deletedAttachments: ChatMessageAttachmentRecord[];
  } | null;
};

type ConversationMessagesPage = {
  messages: SerializedConversationMessage[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
};

export class ChatAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = 'ChatAccessError';
    this.status = status;
  }
}

const DEFAULT_CHANNEL_DEFINITIONS = [
  { slug: 'general', name: 'General', description: 'Project-wide updates and async check-ins.' },
  {
    slug: 'delivery',
    name: 'Delivery',
    description: 'Planning, release sequencing, and rollout coordination.',
  },
  {
    slug: 'eng',
    name: 'Eng',
    description: 'Engineering execution, implementation notes, and blockers.',
  },
  {
    slug: 'incidents',
    name: 'Incidents',
    description: 'Operational incidents, triage, and rapid response.',
  },
] as const;

function getAllChatPermissions(): ChatPermissionSet {
  return {
    canBrowseProject: true,
    canAdministerProject: true,
    canBrowseChat: true,
    canCreateChannels: true,
    canPostMessages: true,
    canModerateMessages: true,
    canStartCalls: true,
    canManageCalls: true,
  };
}

function getNoChatPermissions(): ChatPermissionSet {
  return {
    canBrowseProject: false,
    canAdministerProject: false,
    canBrowseChat: false,
    canCreateChannels: false,
    canPostMessages: false,
    canModerateMessages: false,
    canStartCalls: false,
    canManageCalls: false,
  };
}

function toPermissionValue(value: string | null | undefined, fallback = false) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function slugifyChannel(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'channel'
  );
}

export async function resolveProjectIdOrThrow(projectIdOrKey: string, userId?: string) {
  const project = await resolveProjectByIdOrKey(projectIdOrKey, userId);
  if (!project) {
    throw new ChatAccessError('Project not found', 404);
  }

  return project.id;
}

export async function getProjectChatContext(
  userId: string,
  projectIdOrKey: string
): Promise<ProjectChatContext> {
  const project = await resolveProjectByIdOrKey(projectIdOrKey, userId);
  if (!project) {
    throw new ChatAccessError('Project not found', 404);
  }

  const [[user]] = await Promise.all([
    db
      .select({
        id: users.id,
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  const [[organization], [orgMember], [projectMember]] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, project.organizationId)).limit(1),
    db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1),
    db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)))
      .limit(1),
  ]);

  if (!organization) {
    throw new ChatAccessError('Organization not found', 404);
  }

  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isOrgOwner = orgMember?.role === 'owner';
  const isOrgAdmin = orgMember?.role === 'admin';
  const hasOrgProjectManagement = roleHasPermission(
    orgMember?.role || '',
    'project:manage',
    isSuperAdmin
  );
  const roleDefaults = projectMember
    ? ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole]
    : null;

  let permissions: ChatPermissionSet = getNoChatPermissions();

  if (hasOrgProjectManagement) {
    permissions = getAllChatPermissions();
  } else if (projectMember) {
    permissions = {
      canBrowseProject: toPermissionValue(
        projectMember.canBrowseProject,
        roleDefaults?.canBrowseProject
      ),
      canAdministerProject: toPermissionValue(
        projectMember.canAdministerProject,
        roleDefaults?.canAdministerProject
      ),
      canBrowseChat: toPermissionValue(projectMember.canBrowseChat, roleDefaults?.canBrowseChat),
      canCreateChannels: toPermissionValue(
        projectMember.canCreateChannels,
        roleDefaults?.canCreateChannels
      ),
      canPostMessages: toPermissionValue(
        projectMember.canPostMessages,
        roleDefaults?.canPostMessages
      ),
      canModerateMessages: toPermissionValue(
        projectMember.canModerateMessages,
        roleDefaults?.canModerateMessages
      ),
      canStartCalls: toPermissionValue(projectMember.canStartCalls, roleDefaults?.canStartCalls),
      canManageCalls: toPermissionValue(projectMember.canManageCalls, roleDefaults?.canManageCalls),
    };
  }

  const workspaceSettings = normalizeWorkspaceCommunicationsSettings(
    (organization.settings as Record<string, unknown> | null)?.communications
  );
  const projectSettings = normalizeProjectCommunicationsSettings(
    (project.settings as Record<string, unknown> | null)?.communications
  );
  const effectiveSettings = resolveEffectiveProjectCommunicationsSettings(
    workspaceSettings,
    projectSettings
  );

  return {
    project,
    organization,
    projectRole: (projectMember?.role as ProjectRole | undefined) || null,
    orgRole: orgMember?.role || null,
    isSuperAdmin,
    isOrgOwner,
    isOrgAdmin,
    permissions,
    workspaceSettings,
    projectSettings,
    effectiveSettings,
    canView: permissions.canBrowseProject && permissions.canBrowseChat,
    canManageSettings: hasOrgProjectManagement || permissions.canAdministerProject,
  };
}

export async function ensureDefaultProjectChannels(params: {
  projectId: string;
  organizationId: string;
  userId: string;
}) {
  let channels = await db
    .select()
    .from(projectChannels)
    .where(
      and(eq(projectChannels.projectId, params.projectId), eq(projectChannels.isArchived, false))
    )
    .orderBy(asc(projectChannels.position), asc(projectChannels.name));

  if (channels.length === 0) {
    const createdChannels = [];

    for (const [index, definition] of DEFAULT_CHANNEL_DEFINITIONS.entries()) {
      const channelId = createId();
      const [channel] = await db
        .insert(projectChannels)
        .values({
          id: channelId,
          organizationId: params.organizationId,
          projectId: params.projectId,
          name: definition.name,
          slug: definition.slug,
          description: definition.description,
          isDefault: index === 0,
          position: index,
          createdBy: params.userId,
          updatedBy: params.userId,
        })
        .returning();

      if (!channel) {
        continue;
      }

      await db.insert(conversationRooms).values({
        id: createId(),
        organizationId: params.organizationId,
        projectId: params.projectId,
        kind: 'channel',
        channelId: channel.id,
        title: `#${channel.slug}`,
        createdBy: params.userId,
        updatedBy: params.userId,
      });

      createdChannels.push(channel);
    }

    channels = createdChannels;
  } else {
    for (const channel of channels) {
      const [existingRoom] = await db
        .select({ id: conversationRooms.id })
        .from(conversationRooms)
        .where(eq(conversationRooms.channelId, channel.id))
        .limit(1);

      if (!existingRoom) {
        await db.insert(conversationRooms).values({
          id: createId(),
          organizationId: channel.organizationId,
          projectId: channel.projectId,
          kind: 'channel',
          channelId: channel.id,
          title: `#${channel.slug}`,
          createdBy: params.userId,
          updatedBy: params.userId,
        });
      }
    }
  }

  return channels;
}

export async function getChannelWithRoom(channelId: string) {
  const [row] = await db
    .select({
      channel: projectChannels,
      room: conversationRooms,
    })
    .from(projectChannels)
    .innerJoin(conversationRooms, eq(conversationRooms.channelId, projectChannels.id))
    .where(eq(projectChannels.id, channelId))
    .limit(1);

  return row || null;
}

export async function ensureIssueConversationRoom(userId: string, issueId: string) {
  const issue = await getIssueById(issueId);
  if (!issue) {
    throw new ChatAccessError('Issue not found', 404);
  }

  const context = await getProjectChatContext(userId, issue.projectId);
  if (
    !context.canView ||
    !context.effectiveSettings.enabled ||
    !context.effectiveSettings.issueThreadsEnabled
  ) {
    throw new ChatAccessError('Issue discussions are disabled or unavailable in this project.');
  }

  const [existingRoom] = await db
    .select()
    .from(conversationRooms)
    .where(eq(conversationRooms.issueId, issue.id))
    .limit(1);

  if (existingRoom) {
    return { room: existingRoom, issue, context };
  }

  const [room] = await db
    .insert(conversationRooms)
    .values({
      id: createId(),
      organizationId: issue.organizationId,
      projectId: issue.projectId,
      kind: 'issue_thread',
      issueId: issue.id,
      title: `${issue.key} · ${issue.title}`,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  if (!room) {
    throw new ChatAccessError('Failed to create issue discussion room', 500);
  }

  return { room, issue, context };
}

export async function ensureDocumentConversationRoom(userId: string, pageId: string) {
  const pageAccess = await resolveDocumentPageAccess(userId, pageId);
  if (!pageAccess?.page) {
    throw new ChatAccessError('Document page not found', 404);
  }

  if (!pageAccess.page.projectId) {
    throw new ChatAccessError(
      'Document discussions are currently available for project docs only.',
      409
    );
  }

  const context = await getProjectChatContext(userId, pageAccess.page.projectId);
  if (
    !context.canView ||
    !context.effectiveSettings.enabled ||
    !context.effectiveSettings.documentThreadsEnabled
  ) {
    throw new ChatAccessError('Document discussions are disabled or unavailable in this project.');
  }

  const [existingRoom] = await db
    .select()
    .from(conversationRooms)
    .where(eq(conversationRooms.documentPageId, pageId))
    .limit(1);

  if (existingRoom) {
    return { room: existingRoom, page: pageAccess.page, context };
  }

  const [room] = await db
    .insert(conversationRooms)
    .values({
      id: createId(),
      organizationId: pageAccess.page.organizationId,
      projectId: pageAccess.page.projectId,
      kind: 'document_thread',
      documentPageId: pageAccess.page.id,
      title: pageAccess.page.title,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  if (!room) {
    throw new ChatAccessError('Failed to create document discussion room', 500);
  }

  return { room, page: pageAccess.page, context };
}

export async function resolveConversationRoomAccess(userId: string, roomId: string) {
  const [room] = await db
    .select()
    .from(conversationRooms)
    .where(eq(conversationRooms.id, roomId))
    .limit(1);

  if (!room) {
    return null;
  }

  const context = await getProjectChatContext(userId, room.projectId);
  if (!context.canView) {
    return null;
  }

  if (!context.effectiveSettings.enabled) {
    throw new ChatAccessError('Chat is disabled in this project.');
  }

  if (room.kind === 'channel' && room.channelId) {
    const [channel] = await db
      .select({ id: projectChannels.id, isArchived: projectChannels.isArchived })
      .from(projectChannels)
      .where(eq(projectChannels.id, room.channelId))
      .limit(1);

    if (!channel || channel.isArchived) {
      return null;
    }
  }

  if (room.kind === 'issue_thread' && !context.effectiveSettings.issueThreadsEnabled) {
    throw new ChatAccessError('Issue discussions are disabled in this project.');
  }

  if (room.kind === 'document_thread' && !context.effectiveSettings.documentThreadsEnabled) {
    throw new ChatAccessError('Document discussions are disabled in this project.');
  }

  return { room, context };
}

function parseAttachments(value: unknown): ChatMessageAttachmentRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry) => entry && typeof entry === 'object'
  ) as ChatMessageAttachmentRecord[];
}

function parseMentions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => typeof entry === 'string') as string[];
}

export async function listConversationMessages(roomId: string, currentUserId: string) {
  const page = await listConversationMessagesPage(roomId, currentUserId);
  return page.messages;
}

function parseDeletedSnapshot(bodyJson: unknown) {
  if (!bodyJson || typeof bodyJson !== 'object' || !('deletedSnapshot' in bodyJson)) {
    return null;
  }

  const snapshot = (bodyJson as { deletedSnapshot?: unknown }).deletedSnapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  return snapshot as {
    body?: unknown;
    attachments?: unknown;
    deletedById?: unknown;
    deletedByName?: unknown;
    deletedAt?: unknown;
  };
}

async function serializeConversationMessageRows(params: {
  rows: Array<{
    message: typeof chatMessages.$inferSelect;
    author: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
  currentUserId: string;
  canModerateMessages: boolean;
}) {
  const messageIds = params.rows.map((row) => row.message.id);
  const reactions = messageIds.length
    ? await db
        .select()
        .from(chatMessageReactions)
        .where(inArray(chatMessageReactions.messageId, messageIds))
    : [];

  const reactionsByMessage = new Map<string, SerializedReaction[]>();

  for (const reaction of reactions) {
    const list = reactionsByMessage.get(reaction.messageId) || [];
    const existing = list.find((entry) => entry.emoji === reaction.emoji);

    if (existing) {
      existing.count += 1;
      existing.reactedUserIds.push(reaction.userId);
      existing.reactedByCurrentUser =
        existing.reactedByCurrentUser || reaction.userId === params.currentUserId;
    } else {
      list.push({
        emoji: reaction.emoji,
        count: 1,
        reactedUserIds: [reaction.userId],
        reactedByCurrentUser: reaction.userId === params.currentUserId,
      });
    }

    reactionsByMessage.set(reaction.messageId, list);
  }

  const deleterIds = [
    ...new Set(
      params.rows
        .map((row) => {
          const snapshot = parseDeletedSnapshot(row.message.bodyJson);
          return typeof snapshot?.deletedById === 'string'
            ? snapshot.deletedById
            : row.message.deletedAt
              ? row.message.updatedBy
              : null;
        })
        .filter((value): value is string => Boolean(value))
    ),
  ];

  const deleterMap = deleterIds.length
    ? new Map(
        (
          await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(inArray(users.id, deleterIds))
        ).map((user) => [user.id, user.name || user.email || null])
      )
    : new Map<string, string | null>();

  return params.rows.map((row) => {
    const messageMentions = parseMentions(row.message.mentions);
    const messageAttachments = parseAttachments(row.message.attachments);
    const deletedSnapshot = parseDeletedSnapshot(row.message.bodyJson);
    const deletedBody =
      typeof deletedSnapshot?.body === 'string'
        ? deletedSnapshot.body
        : row.message.deletedAt
          ? row.message.body
          : '';
    const deletedAttachments = parseAttachments(
      deletedSnapshot && typeof deletedSnapshot.attachments !== 'undefined'
        ? deletedSnapshot.attachments
        : row.message.attachments
    );
    const deletedById =
      typeof deletedSnapshot?.deletedById === 'string'
        ? deletedSnapshot.deletedById
        : row.message.deletedAt
          ? row.message.updatedBy
          : null;
    const deletedByName =
      typeof deletedSnapshot?.deletedByName === 'string'
        ? deletedSnapshot.deletedByName
        : deletedById
          ? deleterMap.get(deletedById) || null
          : null;

    return {
      ...row.message,
      body: row.message.deletedAt && !params.canModerateMessages ? '' : row.message.body,
      mentions: row.message.deletedAt ? [] : messageMentions,
      attachments: row.message.deletedAt ? [] : messageAttachments,
      reactions: reactionsByMessage.get(row.message.id) || [],
      author: row.author,
      canDelete:
        !row.message.deletedAt &&
        (row.message.createdBy === params.currentUserId || params.canModerateMessages),
      canEdit:
        !row.message.deletedAt &&
        (row.message.createdBy === params.currentUserId || params.canModerateMessages),
      moderation:
        row.message.deletedAt && params.canModerateMessages
          ? {
              deletedBody,
              deletedById,
              deletedByName,
              deletedAt: row.message.deletedAt.toISOString(),
              deletedAttachments,
            }
          : null,
    } satisfies SerializedConversationMessage;
  });
}

async function getConversationMessageById(
  roomId: string,
  messageId: string,
  currentUserId: string
): Promise<SerializedConversationMessage | null> {
  const access = await resolveConversationRoomAccess(currentUserId, roomId);
  if (!access) {
    throw new ChatAccessError('Conversation not found or unavailable.', 404);
  }

  const [row] = await db
    .select({
      message: chatMessages,
      author: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.createdBy))
    .where(and(eq(chatMessages.roomId, roomId), eq(chatMessages.id, messageId)))
    .limit(1);

  if (!row) {
    return null;
  }

  const [message] = await serializeConversationMessageRows({
    rows: [row],
    currentUserId,
    canModerateMessages: access.context.permissions.canModerateMessages,
  });

  return message || null;
}

export async function listConversationMessagesPage(
  roomId: string,
  currentUserId: string,
  options: {
    beforeMessageId?: string | null;
    limit?: number;
  } = {}
): Promise<ConversationMessagesPage> {
  const access = await resolveConversationRoomAccess(currentUserId, roomId);
  if (!access) {
    throw new ChatAccessError('Conversation not found or unavailable.', 404);
  }

  const limit = Math.min(Math.max(options.limit ?? 40, 20), 100);
  let beforeMessage: { id: string; createdAt: Date } | null = null;

  if (options.beforeMessageId) {
    const [cursorMessage] = await db
      .select({ id: chatMessages.id, createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(and(eq(chatMessages.roomId, roomId), eq(chatMessages.id, options.beforeMessageId)))
      .limit(1);

    if (!cursorMessage) {
      throw new ChatAccessError('Message cursor not found for this conversation.', 404);
    }

    beforeMessage = cursorMessage;
  }

  const rows = await db
    .select({
      message: chatMessages,
      author: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.createdBy))
    .where(
      and(
        eq(chatMessages.roomId, roomId),
        beforeMessage
          ? sql`(${chatMessages.createdAt} < ${beforeMessage.createdAt} OR (${chatMessages.createdAt} = ${beforeMessage.createdAt} AND ${chatMessages.id} < ${beforeMessage.id}))`
          : sql`true`
      )
    )
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit).reverse();
  const messages = await serializeConversationMessageRows({
    rows: pageRows,
    currentUserId,
    canModerateMessages: access.context.permissions.canModerateMessages,
  });

  return {
    messages,
    pageInfo: {
      hasMore,
      nextCursor: hasMore ? pageRows[0]?.message.id || null : null,
    },
  };
}

async function getUnreadCountForRoom(roomId: string, userId: string, lastReadAt: Date | null) {
  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.roomId, roomId),
        isNull(chatMessages.deletedAt),
        ne(chatMessages.createdBy, userId),
        lastReadAt ? gt(chatMessages.createdAt, lastReadAt) : sql`true`
      )
    );

  return Number(result?.count || 0);
}

export async function markConversationRead(
  roomId: string,
  userId: string,
  lastReadMessageId?: string | null
) {
  const latestMessageId = lastReadMessageId
    ? lastReadMessageId
    : (
        await db
          .select({ id: chatMessages.id })
          .from(chatMessages)
          .where(eq(chatMessages.roomId, roomId))
          .orderBy(desc(chatMessages.createdAt))
          .limit(1)
      )[0]?.id || null;

  const now = new Date();
  const [existing] = await db
    .select({ id: roomReadStates.id })
    .from(roomReadStates)
    .where(and(eq(roomReadStates.roomId, roomId), eq(roomReadStates.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .update(roomReadStates)
      .set({
        lastReadMessageId: latestMessageId,
        lastReadAt: now,
        updatedAt: now,
      })
      .where(eq(roomReadStates.id, existing.id));
  } else {
    await db.insert(roomReadStates).values({
      id: createId(),
      roomId,
      userId,
      lastReadMessageId: latestMessageId,
      lastReadAt: now,
      updatedAt: now,
    });
  }
}

function extractMentions(
  body: string,
  projectMembersList: Array<{ userId: string; name: string | null; email: string | null }>
) {
  const matches = [...body.matchAll(/@([a-z0-9._-]+)/gi)]
    .map((match) => match[1]?.toLowerCase())
    .filter((match): match is string => Boolean(match));
  if (matches.length === 0) {
    return [];
  }

  const mentionedIds = new Set<string>();
  for (const member of projectMembersList) {
    const nameParts = member.name?.toLowerCase().split(/\s+/).filter(Boolean) || [];
    const aliases = new Set<string>([
      ...nameParts,
      member.name?.toLowerCase().replace(/\s+/g, '') || '',
      member.email?.split('@')[0]?.toLowerCase() || '',
    ]);

    if (matches.some((match) => aliases.has(match))) {
      mentionedIds.add(member.userId);
    }
  }

  return [...mentionedIds];
}

export async function createConversationMessage(params: {
  roomId: string;
  userId: string;
  body: string;
  attachments?: ChatMessageAttachmentRecord[];
  parentMessageId?: string | null;
}) {
  const access = await resolveConversationRoomAccess(params.userId, params.roomId);
  if (!access) {
    throw new ChatAccessError('Conversation not found or unavailable.', 404);
  }

  if (!access.context.permissions.canPostMessages) {
    throw new ChatAccessError('You do not have permission to post messages in this project.');
  }

  if (params.attachments?.length && !access.context.effectiveSettings.attachmentsEnabled) {
    throw new ChatAccessError('Attachments are disabled in this project.');
  }

  const projectMemberList = await db
    .select({
      userId: projectMembers.userId,
      name: users.name,
      email: users.email,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, access.context.project.id));

  const mentions = extractMentions(params.body, projectMemberList);
  const now = new Date();
  const [message] = await db
    .insert(chatMessages)
    .values({
      id: createId(),
      organizationId: access.context.project.organizationId,
      projectId: access.context.project.id,
      roomId: params.roomId,
      parentMessageId: params.parentMessageId || null,
      body: params.body,
      bodyJson: { markdown: params.body },
      mentions,
      attachments: params.attachments || [],
      createdBy: params.userId,
      updatedBy: params.userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!message) {
    throw new ChatAccessError('Failed to create message', 500);
  }

  await db
    .update(conversationRooms)
    .set({
      lastMessageAt: now,
      lastActivityAt: now,
      updatedAt: now,
      updatedBy: params.userId,
    })
    .where(eq(conversationRooms.id, params.roomId));

  await markConversationRead(params.roomId, params.userId, message.id);

  await createAuditLog({
    userId: params.userId,
    organizationId: access.context.project.organizationId,
    action: 'chat.message_created',
    resourceType: 'chat_message',
    resourceId: message.id,
    projectId: access.context.project.id,
    issueId: access.room.issueId || undefined,
    metadata: {
      roomId: params.roomId,
      roomKind: access.room.kind,
      attachmentCount: params.attachments?.length || 0,
      mentionCount: mentions.length,
    },
  });

  const [author] = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  const responseMessage = {
    ...message,
    mentions,
    attachments: params.attachments || [],
    reactions: [] as SerializedReaction[],
    author,
    canDelete: true,
    canEdit: true,
    moderation: null,
  };

  await publishRoomEvent(params.roomId, {
    type: 'message.created',
    data: {
      roomId: params.roomId,
      message: responseMessage,
    },
  });

  return responseMessage;
}

export async function updateConversationMessage(params: {
  roomId: string;
  messageId: string;
  userId: string;
  body?: string;
  reactionEmoji?: string;
}) {
  const access = await resolveConversationRoomAccess(params.userId, params.roomId);
  if (!access) {
    throw new ChatAccessError('Conversation not found or unavailable.', 404);
  }

  const [existing] = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.id, params.messageId), eq(chatMessages.roomId, params.roomId)))
    .limit(1);

  if (!existing) {
    throw new ChatAccessError('Message not found', 404);
  }

  if (existing.deletedAt && !params.reactionEmoji) {
    throw new ChatAccessError('Deleted messages cannot be edited.', 400);
  }

  if (params.reactionEmoji) {
    if (!access.context.permissions.canPostMessages) {
      throw new ChatAccessError('You do not have permission to react to messages.');
    }

    const [existingReaction] = await db
      .select()
      .from(chatMessageReactions)
      .where(
        and(
          eq(chatMessageReactions.messageId, params.messageId),
          eq(chatMessageReactions.userId, params.userId),
          eq(chatMessageReactions.emoji, params.reactionEmoji)
        )
      )
      .limit(1);

    if (existingReaction) {
      await db.delete(chatMessageReactions).where(eq(chatMessageReactions.id, existingReaction.id));
    } else {
      await db.insert(chatMessageReactions).values({
        id: createId(),
        messageId: params.messageId,
        userId: params.userId,
        emoji: params.reactionEmoji,
      });
    }

    const message = await getConversationMessageById(
      params.roomId,
      params.messageId,
      params.userId
    );

    await publishRoomEvent(params.roomId, {
      type: 'message.reaction',
      data: {
        roomId: params.roomId,
        messageId: params.messageId,
        reactions: message?.reactions || [],
      },
    });

    return message;
  }

  if (!params.body?.trim()) {
    throw new ChatAccessError('Message body is required', 400);
  }

  const canEdit =
    existing.createdBy === params.userId || access.context.permissions.canModerateMessages;
  if (!canEdit) {
    throw new ChatAccessError('You do not have permission to edit this message.');
  }

  const projectMemberList = await db
    .select({
      userId: projectMembers.userId,
      name: users.name,
      email: users.email,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, access.context.project.id));
  const mentions = extractMentions(params.body, projectMemberList);

  await db
    .update(chatMessages)
    .set({
      body: params.body,
      bodyJson: { markdown: params.body },
      mentions,
      editedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: params.userId,
    })
    .where(eq(chatMessages.id, params.messageId));

  await createAuditLog({
    userId: params.userId,
    organizationId: access.context.project.organizationId,
    action: 'chat.message_updated',
    resourceType: 'chat_message',
    resourceId: params.messageId,
    projectId: access.context.project.id,
    issueId: access.room.issueId || undefined,
    metadata: { roomId: params.roomId },
  });

  const message = await getConversationMessageById(params.roomId, params.messageId, params.userId);
  await publishRoomEvent(params.roomId, {
    type: 'message.updated',
    data: {
      roomId: params.roomId,
      message,
    },
  });

  return message;
}

export async function deleteConversationMessage(params: {
  roomId: string;
  messageId: string;
  userId: string;
}) {
  const access = await resolveConversationRoomAccess(params.userId, params.roomId);
  if (!access) {
    throw new ChatAccessError('Conversation not found or unavailable.', 404);
  }

  const [existing] = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.id, params.messageId), eq(chatMessages.roomId, params.roomId)))
    .limit(1);

  if (!existing) {
    throw new ChatAccessError('Message not found', 404);
  }

  if (existing.deletedAt) {
    return getConversationMessageById(params.roomId, params.messageId, params.userId);
  }

  const canDelete =
    existing.createdBy === params.userId || access.context.permissions.canModerateMessages;
  if (!canDelete) {
    throw new ChatAccessError('You do not have permission to delete this message.');
  }

  const now = new Date();
  const deletedAttachments = parseAttachments(existing.attachments);

  await db
    .update(chatMessages)
    .set({
      body: '',
      bodyJson: {
        deletedSnapshot: {
          body: existing.body,
          attachments: deletedAttachments,
          deletedById: params.userId,
          deletedAt: now.toISOString(),
        },
      },
      deletedAt: now,
      updatedAt: now,
      updatedBy: params.userId,
    })
    .where(eq(chatMessages.id, params.messageId));

  await createAuditLog({
    userId: params.userId,
    organizationId: access.context.project.organizationId,
    action: 'chat.message_deleted',
    resourceType: 'chat_message',
    resourceId: params.messageId,
    projectId: access.context.project.id,
    issueId: access.room.issueId || undefined,
    metadata: { roomId: params.roomId },
  });

  await publishRoomEvent(params.roomId, {
    type: 'message.deleted',
    data: {
      roomId: params.roomId,
      messageId: params.messageId,
    },
  });

  return getConversationMessageById(params.roomId, params.messageId, params.userId);
}

async function syncConversationRoomMessagePointers(roomId: string, userId: string) {
  const [latestMessage] = await db
    .select({ createdAt: chatMessages.createdAt })
    .from(chatMessages)
    .where(eq(chatMessages.roomId, roomId))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(1);

  const now = new Date();
  await db
    .update(conversationRooms)
    .set({
      lastMessageAt: latestMessage?.createdAt || null,
      lastActivityAt: latestMessage?.createdAt || now,
      updatedAt: now,
      updatedBy: userId,
    })
    .where(eq(conversationRooms.id, roomId));
}

export async function moderateConversationMessages(params: {
  roomId: string;
  userId: string;
  action: 'clear_deleted' | 'clear_room';
}) {
  const access = await resolveConversationRoomAccess(params.userId, params.roomId);
  if (!access) {
    throw new ChatAccessError('Conversation not found or unavailable.', 404);
  }

  if (!access.context.permissions.canModerateMessages) {
    throw new ChatAccessError('You do not have permission to moderate this conversation.', 403);
  }

  const whereClause = and(
    eq(chatMessages.roomId, params.roomId),
    params.action === 'clear_deleted' ? sql`${chatMessages.deletedAt} is not null` : sql`true`
  );

  const affectedMessages = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(whereClause);

  if (!affectedMessages.length) {
    return {
      action: params.action,
      affectedCount: 0,
    };
  }

  await db.delete(chatMessages).where(whereClause);
  await syncConversationRoomMessagePointers(params.roomId, params.userId);

  await createAuditLog({
    userId: params.userId,
    organizationId: access.context.project.organizationId,
    action: 'chat.message_deleted',
    resourceType: 'conversation_room',
    resourceId: params.roomId,
    projectId: access.context.project.id,
    issueId: access.room.issueId || undefined,
    metadata: {
      roomId: params.roomId,
      moderationAction: params.action,
      affectedCount: affectedMessages.length,
    },
  });

  await publishRoomEvent(params.roomId, {
    type: 'messages.cleared',
    data: {
      roomId: params.roomId,
      action: params.action,
      affectedCount: affectedMessages.length,
    },
  });

  return {
    action: params.action,
    affectedCount: affectedMessages.length,
  };
}

export async function buildConversationContext(roomId: string) {
  const [room] = await db
    .select()
    .from(conversationRooms)
    .where(eq(conversationRooms.id, roomId))
    .limit(1);

  if (!room) {
    return null;
  }

  if (room.kind === 'channel' && room.channelId) {
    const [channel] = await db
      .select()
      .from(projectChannels)
      .where(eq(projectChannels.id, room.channelId))
      .limit(1);

    return {
      room,
      context: channel
        ? {
            type: 'channel' as const,
            id: channel.id,
            title: channel.name,
            description: channel.description,
            slug: channel.slug,
          }
        : null,
    };
  }

  if (room.kind === 'issue_thread' && room.issueId) {
    const issue = await getIssueById(room.issueId);
    return {
      room,
      context: issue
        ? {
            type: 'issue' as const,
            id: issue.id,
            title: issue.title,
            key: issue.key,
            description: issue.description,
          }
        : null,
    };
  }

  if (room.kind === 'document_thread' && room.documentPageId) {
    const [page] = await db
      .select({
        id: documentPages.id,
        title: documentPages.title,
        slug: documentPages.slug,
        excerpt: documentPages.excerpt,
        icon: documentPages.icon,
      })
      .from(documentPages)
      .where(eq(documentPages.id, room.documentPageId))
      .limit(1);

    return {
      room,
      context: page
        ? {
            type: 'document' as const,
            id: page.id,
            title: page.title,
            slug: page.slug,
            excerpt: page.excerpt,
            icon: page.icon,
          }
        : null,
    };
  }

  return { room, context: null };
}

type ActiveCallState = typeof callSessions.$inferSelect & {
  databaseParticipantCount: number;
  freshHeartbeatCount: number;
};

/**
 * Collapses rows belonging to the same user down to their most recent join.
 * Exported so tests can exercise the dedupe rule without touching the DB.
 */
export function dedupeActiveParticipantsByUserId<T extends { userId: string; joinedAt: Date }>(
  participants: T[]
): T[] {
  const newestByUser = new Map<string, T>();
  for (const participant of participants) {
    const existing = newestByUser.get(participant.userId);
    if (!existing || participant.joinedAt.getTime() > existing.joinedAt.getTime()) {
      newestByUser.set(participant.userId, participant);
    }
  }
  return Array.from(newestByUser.values());
}

function parseParticipantHeartbeat(metadata: unknown, joinedAt: Date) {
  if (!metadata || typeof metadata !== 'object' || !('lastSeenAt' in metadata)) {
    return joinedAt;
  }

  const rawValue = (metadata as { lastSeenAt?: unknown }).lastSeenAt;
  if (typeof rawValue !== 'string') {
    return joinedAt;
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? joinedAt : parsed;
}

async function getActiveCallState(roomId: string): Promise<ActiveCallState | null> {
  const [call] = await db
    .select()
    .from(callSessions)
    .where(and(eq(callSessions.roomId, roomId), eq(callSessions.status, 'active')))
    .orderBy(desc(callSessions.startedAt))
    .limit(1);

  if (!call) {
    return null;
  }

  const participants = await db
    .select({
      userId: callParticipants.userId,
      joinedAt: callParticipants.joinedAt,
      metadata: callParticipants.metadata,
    })
    .from(callParticipants)
    .where(and(eq(callParticipants.callSessionId, call.id), isNull(callParticipants.leftAt)));

  const now = new Date();
  const uniqueParticipants = dedupeActiveParticipantsByUserId(participants);
  const freshHeartbeatCount = uniqueParticipants.filter((participant) => {
    const lastSeenAt = parseParticipantHeartbeat(participant.metadata, participant.joinedAt);
    return now.getTime() - lastSeenAt.getTime() <= ACTIVE_CALL_HEARTBEAT_STALE_MS;
  }).length;

  return {
    ...call,
    databaseParticipantCount: uniqueParticipants.length,
    freshHeartbeatCount,
  };
}

async function getActiveCallStateByLivekitRoomName(
  livekitRoomName: string
): Promise<ActiveCallState | null> {
  const [call] = await db
    .select()
    .from(callSessions)
    .where(
      and(eq(callSessions.livekitRoomName, livekitRoomName), eq(callSessions.status, 'active'))
    )
    .orderBy(desc(callSessions.startedAt))
    .limit(1);

  if (!call) {
    return null;
  }

  const participants = await db
    .select({
      userId: callParticipants.userId,
      joinedAt: callParticipants.joinedAt,
      metadata: callParticipants.metadata,
    })
    .from(callParticipants)
    .where(and(eq(callParticipants.callSessionId, call.id), isNull(callParticipants.leftAt)));

  const now = new Date();
  const uniqueParticipants = dedupeActiveParticipantsByUserId(participants);
  const freshHeartbeatCount = uniqueParticipants.filter((participant) => {
    const lastSeenAt = parseParticipantHeartbeat(participant.metadata, participant.joinedAt);
    return now.getTime() - lastSeenAt.getTime() <= ACTIVE_CALL_HEARTBEAT_STALE_MS;
  }).length;

  return {
    ...call,
    databaseParticipantCount: uniqueParticipants.length,
    freshHeartbeatCount,
  };
}

function buildCallParticipantHeartbeatMetadata(
  metadata: Record<string, unknown> | null | undefined,
  now: Date
) {
  return {
    ...(metadata || {}),
    lastSeenAt: now.toISOString(),
  };
}

async function getLivekitRoomOccupancy(livekitRoomName: string) {
  const livekitServerUrl = process.env.LIVEKIT_URL || '';
  if (livekitServerUrl.includes('host.docker.internal')) {
    return {
      roomExists: null as boolean | null,
      participantCount: null as number | null,
    };
  }

  const roomService = await createLivekitRoomService();
  if (!roomService) {
    return {
      roomExists: null as boolean | null,
      participantCount: null as number | null,
    };
  }

  try {
    const participants = await roomService.listParticipants(livekitRoomName);
    return {
      roomExists: true,
      participantCount: participants.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (
      message.includes('not_found') ||
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('room not found')
    ) {
      return {
        roomExists: false,
        participantCount: 0,
      };
    }

    console.warn('Failed to inspect LiveKit room participants:', error);
    return {
      roomExists: null as boolean | null,
      participantCount: null as number | null,
    };
  }
}

async function finalizeActiveCallSession(
  callId: string,
  options: {
    endedByUserId?: string | null;
    issueId?: string | null;
    reason: string;
  }
) {
  chatServerDebug('call.finalize.start', {
    callId,
    options,
  });
  const finalizedCall = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${callId}))`);

    const [call] = await tx.select().from(callSessions).where(eq(callSessions.id, callId)).limit(1);

    if (!call || call.status !== 'active') {
      return null;
    }

    const now = new Date();
    await tx
      .update(callSessions)
      .set({
        status: 'ended',
        endedAt: now,
        endedBy: options.endedByUserId ?? null,
        updatedAt: now,
      })
      .where(eq(callSessions.id, call.id));

    await tx
      .update(callParticipants)
      .set({
        leftAt: now,
      })
      .where(and(eq(callParticipants.callSessionId, call.id), isNull(callParticipants.leftAt)));

    return call;
  });

  if (!finalizedCall) {
    chatServerDebug('call.finalize.skip', {
      callId,
      reason: 'not_found_or_not_active',
    });
    return null;
  }

  const livekitServerUrl = process.env.LIVEKIT_URL || '';
  const roomService = livekitServerUrl.includes('host.docker.internal')
    ? null
    : await createLivekitRoomService();
  if (roomService) {
    void roomService.deleteRoom(finalizedCall.livekitRoomName).catch((error) => {
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (
        message.includes('not_found') ||
        message.includes('not found') ||
        message.includes('does not exist') ||
        message.includes('room not found')
      ) {
        return;
      }

      console.warn('Failed to delete LiveKit room:', error);
      chatServerError('call.finalize.delete-room.error', {
        callId: finalizedCall.id,
        livekitRoomName: finalizedCall.livekitRoomName,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });
  }

  if (options.endedByUserId) {
    await createAuditLog({
      userId: options.endedByUserId,
      organizationId: finalizedCall.organizationId,
      action: 'chat.call_ended',
      resourceType: 'call_session',
      resourceId: finalizedCall.id,
      projectId: finalizedCall.projectId,
      issueId: options.issueId || undefined,
      metadata: {
        roomId: finalizedCall.roomId,
        livekitRoomName: finalizedCall.livekitRoomName,
        reason: options.reason,
        autoClosed: options.reason !== 'manual_end',
      },
    });
  }

  await publishRoomEvent(finalizedCall.roomId, {
    type: 'call.ended',
    data: {
      roomId: finalizedCall.roomId,
      callId: finalizedCall.id,
      reason: options.reason,
    },
  });

  chatServerDebug('call.finalize.success', {
    callId: finalizedCall.id,
    roomId: finalizedCall.roomId,
    reason: options.reason,
    livekitRoomName: finalizedCall.livekitRoomName,
  });
  return finalizedCall;
}

export async function handleLivekitWebhookEvent(input: {
  event: string;
  roomName?: string | null;
  participantIdentity?: string | null;
  participantMetadata?: string | null;
}) {
  chatServerDebug('livekit.webhook.received', input);
  const roomName = input.roomName?.trim();
  if (!roomName) {
    return { handled: false, reason: 'missing_room_name' as const };
  }

  if (input.event === 'room_finished') {
    const activeCalls = await db
      .select({ id: callSessions.id })
      .from(callSessions)
      .where(and(eq(callSessions.livekitRoomName, roomName), eq(callSessions.status, 'active')));

    if (!activeCalls.length) {
      return { handled: false, reason: 'call_not_found' as const };
    }

    await Promise.all(
      activeCalls.map((call) =>
        finalizeActiveCallSession(call.id, {
          reason: 'livekit_room_finished',
        })
      )
    );

    return {
      handled: true,
      reason: 'room_finished' as const,
      finalizedCalls: activeCalls.length,
    };
  }

  const call = await getActiveCallStateByLivekitRoomName(roomName);
  if (!call) {
    return { handled: false, reason: 'call_not_found' as const };
  }

  const parsedMetadata = (() => {
    if (!input.participantMetadata) {
      return null;
    }

    try {
      return JSON.parse(input.participantMetadata) as {
        userId?: string;
        clientSessionId?: string;
      };
    } catch {
      return null;
    }
  })();
  const parsedIdentity = parseLivekitParticipantIdentity(input.participantIdentity);
  const participantIdentity = parsedIdentity.participantIdentity;
  const participantUserId = parsedMetadata?.userId || parsedIdentity.userId;

  if (input.event === 'participant_joined') {
    const now = new Date();

    if (participantIdentity && participantUserId) {
      const [existingParticipant] = await db
        .select({ id: callParticipants.id })
        .from(callParticipants)
        .where(
          and(
            eq(callParticipants.callSessionId, call.id),
            eq(callParticipants.participantIdentity, participantIdentity),
            isNull(callParticipants.leftAt)
          )
        )
        .limit(1);

      if (!existingParticipant) {
        await db.insert(callParticipants).values({
          id: createId(),
          callSessionId: call.id,
          userId: participantUserId,
          participantIdentity,
          joinedAt: now,
          metadata: buildCallParticipantHeartbeatMetadata(
            {
              clientSessionId: parsedMetadata?.clientSessionId || parsedIdentity.clientSessionId,
            },
            now
          ),
        });
      } else {
        await db
          .update(callParticipants)
          .set({
            metadata: buildCallParticipantHeartbeatMetadata(
              {
                clientSessionId: parsedMetadata?.clientSessionId || parsedIdentity.clientSessionId,
              },
              now
            ),
          })
          .where(eq(callParticipants.id, existingParticipant.id));
      }
    }

    await db
      .update(callSessions)
      .set({
        updatedAt: now,
      })
      .where(eq(callSessions.id, call.id));

    const summary = await getActiveCallSummary(call.roomId);
    if (summary) {
      await publishRoomEvent(call.roomId, {
        type: 'call.presence',
        data: {
          roomId: call.roomId,
          call: summary,
        },
      });
    }

    return { handled: true, reason: 'participant_joined' as const };
  }

  if (input.event !== 'participant_left' && input.event !== 'participant_connection_aborted') {
    return { handled: false, reason: 'ignored_event' as const };
  }

  const now = new Date();

  if (participantIdentity) {
    await db
      .update(callParticipants)
      .set({
        leftAt: now,
      })
      .where(
        and(
          eq(callParticipants.callSessionId, call.id),
          eq(callParticipants.participantIdentity, participantIdentity),
          isNull(callParticipants.leftAt)
        )
      );
  } else if (participantUserId) {
    await db
      .update(callParticipants)
      .set({
        leftAt: now,
      })
      .where(
        and(
          eq(callParticipants.callSessionId, call.id),
          eq(callParticipants.userId, participantUserId),
          isNull(callParticipants.leftAt)
        )
      );
  }

  await db
    .update(callSessions)
    .set({
      updatedAt: now,
    })
    .where(eq(callSessions.id, call.id));

  const [remainingParticipants] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(callParticipants)
    .where(and(eq(callParticipants.callSessionId, call.id), isNull(callParticipants.leftAt)));

  if (Number(remainingParticipants?.count || 0) === 0) {
    await finalizeActiveCallSession(call.id, {
      reason:
        input.event === 'participant_connection_aborted'
          ? 'participant_connection_aborted'
          : 'last_participant_left',
    });

    return {
      handled: true,
      reason:
        input.event === 'participant_connection_aborted'
          ? 'participant_connection_aborted'
          : 'last_participant_left',
    };
  }

  const summary = await getActiveCallSummary(call.roomId);
  if (summary) {
    await publishRoomEvent(call.roomId, {
      type: 'call.presence',
      data: {
        roomId: call.roomId,
        call: summary,
      },
    });
  }

  return {
    handled: true,
    reason:
      input.event === 'participant_connection_aborted'
        ? 'participant_connection_aborted'
        : 'participant_left',
  };
}

export async function getActiveCallSummary(roomId: string) {
  chatServerDebug('call.summary.start', {
    roomId,
  });
  const call = await getActiveCallState(roomId);
  const now = new Date();

  if (!call) {
    chatServerDebug('call.summary.none', {
      roomId,
    });
    return null;
  }

  if (call.databaseParticipantCount === 0) {
    chatServerDebug('call.summary.auto-end.database-empty', {
      roomId,
      callId: call.id,
    });
    await finalizeActiveCallSession(call.id, {
      reason: 'last_participant_left',
    });
    return null;
  }

  const livekitOccupancy = await getLivekitRoomOccupancy(call.livekitRoomName);
  if (
    shouldAutoEndActiveCall({
      databaseParticipantCount: call.databaseParticipantCount,
      livekitParticipantCount: livekitOccupancy.participantCount,
      roomExists: livekitOccupancy.roomExists,
      startedAt: call.startedAt,
      now,
    })
  ) {
    chatServerDebug('call.summary.auto-end.livekit-empty', {
      roomId,
      callId: call.id,
      roomExists: livekitOccupancy.roomExists,
      livekitParticipantCount: livekitOccupancy.participantCount,
    });
    await finalizeActiveCallSession(call.id, {
      reason: livekitOccupancy.roomExists === false ? 'livekit_room_missing' : 'livekit_room_empty',
    });
    return null;
  }

  if (
    livekitOccupancy.participantCount === null &&
    !hasFreshHeartbeatParticipants({
      databaseParticipantCount: call.databaseParticipantCount,
      freshHeartbeatCount: call.freshHeartbeatCount,
      startedAt: call.startedAt,
      now,
    })
  ) {
    chatServerDebug('call.summary.auto-end.heartbeat-stale', {
      roomId,
      callId: call.id,
      databaseParticipantCount: call.databaseParticipantCount,
      freshHeartbeatCount: call.freshHeartbeatCount,
    });
    await finalizeActiveCallSession(call.id, {
      reason: 'participant_heartbeat_stale',
    });
    return null;
  }

  const { databaseParticipantCount, freshHeartbeatCount, ...callRecord } = call;
  const summary = {
    ...callRecord,
    participantCount: resolveActiveCallParticipantCount({
      databaseParticipantCount,
      livekitParticipantCount: livekitOccupancy.participantCount,
    }),
  };
  chatServerDebug('call.summary.success', {
    roomId,
    callId: summary.id,
    participantCount: summary.participantCount,
    livekitRoomName: summary.livekitRoomName,
  });
  return summary;
}

export async function listAccessibleActiveCalls(userId: string) {
  const activeCalls = await db
    .select()
    .from(callSessions)
    .where(eq(callSessions.status, 'active'))
    .orderBy(desc(callSessions.startedAt));

  const items = await Promise.all(
    activeCalls.map(async (call) => {
      const access = await resolveConversationRoomAccess(userId, call.roomId);
      if (!access || !access.context.canView || !access.context.effectiveSettings.enabled) {
        return null;
      }

      const summary = await getActiveCallSummary(call.roomId);
      if (!summary || summary.participantCount <= 0) {
        return null;
      }

      const [participant] = await db
        .select({ id: callParticipants.id })
        .from(callParticipants)
        .where(
          and(
            eq(callParticipants.callSessionId, call.id),
            eq(callParticipants.userId, userId),
            isNull(callParticipants.leftAt)
          )
        )
        .limit(1);

      const roomContext = await buildConversationContext(call.roomId);
      const room = roomContext?.room || access.room;
      const conversationTitle =
        room.kind === 'channel'
          ? roomContext?.context && 'title' in roomContext.context
            ? String(roomContext.context.title)
            : 'Channel call'
          : roomContext?.context && 'title' in roomContext.context
            ? String(roomContext.context.title)
            : room.kind === 'issue_thread'
              ? 'Issue discussion'
              : 'Document discussion';
      const conversationSubtitle =
        room.kind === 'channel'
          ? roomContext?.context && 'description' in roomContext.context
            ? (roomContext.context.description as string | null) || 'Project channel'
            : 'Project channel'
          : room.kind === 'issue_thread'
            ? roomContext?.context && 'key' in roomContext.context
              ? String(roomContext.context.key)
              : 'Issue discussion'
            : 'Document discussion';

      return {
        id: summary.id,
        roomId: summary.roomId,
        livekitRoomName: summary.livekitRoomName,
        participantCount: summary.participantCount,
        startedAt: summary.startedAt,
        joinedParticipantId: participant ? participant.id : null,
        isParticipant: Boolean(participant),
        project: {
          id: access.context.project.id,
          key: access.context.project.key,
          name: access.context.project.name,
          path: access.context.project.key.toLowerCase(),
        },
        room: {
          id: room.id,
          kind: room.kind,
          title: conversationTitle,
          subtitle: conversationSubtitle,
          href:
            room.kind === 'document_thread' && room.documentPageId
              ? `/projects/${access.context.project.key.toLowerCase()}/chat?roomId=${room.id}`
              : `/projects/${access.context.project.key.toLowerCase()}/chat?roomId=${room.id}`,
        },
      };
    })
  );

  return items.filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function countResolvedActiveCalls() {
  const activeCalls = await db
    .select({ roomId: callSessions.roomId })
    .from(callSessions)
    .where(eq(callSessions.status, 'active'));

  const summaries = await Promise.all(
    activeCalls.map(async (call) => getActiveCallSummary(call.roomId))
  );

  return summaries.filter(Boolean).length;
}

export async function startConversationCall(roomId: string, userId: string) {
  chatServerDebug('call.start.request', {
    roomId,
    userId,
  });
  const access = await resolveConversationRoomAccess(userId, roomId);
  if (!access) {
    throw new ChatAccessError('Conversation not found or unavailable.', 404);
  }

  if (!access.context.permissions.canStartCalls) {
    throw new ChatAccessError('You do not have permission to start calls in this project.');
  }

  if (!access.context.effectiveSettings.voiceEnabled) {
    throw new ChatAccessError('Voice rooms are disabled in this project.');
  }

  const livekitStatus = getLivekitStatus();
  if (!livekitStatus.ready) {
    throw new ChatAccessError(
      `LiveKit is not configured. Missing ${livekitStatus.missing.join(', ')}.`,
      503
    );
  }

  const existingCall = await getActiveCallSummary(roomId);
  if (existingCall) {
    chatServerDebug('call.start.reuse-active', {
      roomId,
      userId,
      callId: existingCall.id,
    });
    return existingCall;
  }

  const roomName = buildLivekitRoomName(access.context.project.key, roomId);
  const createdCall = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${roomId}))`);

    const [existing] = await tx
      .select()
      .from(callSessions)
      .where(and(eq(callSessions.roomId, roomId), eq(callSessions.status, 'active')))
      .orderBy(desc(callSessions.startedAt))
      .limit(1);

    if (existing) {
      return {
        callId: existing.id,
        livekitRoomName: existing.livekitRoomName,
        created: false,
      };
    }

    const now = new Date();
    const [session] = await tx
      .insert(callSessions)
      .values({
        id: createId(),
        organizationId: access.context.project.organizationId,
        projectId: access.context.project.id,
        roomId,
        livekitRoomName: roomName,
        status: 'active',
        startedBy: userId,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!session) {
      throw new ChatAccessError('Failed to start call', 500);
    }

    await tx.insert(callParticipants).values({
      id: createId(),
      callSessionId: session.id,
      userId,
      joinedAt: now,
      metadata: buildCallParticipantHeartbeatMetadata({}, now),
    });

    return {
      callId: session.id,
      livekitRoomName: session.livekitRoomName,
      created: true,
    };
  });

  const summary = await getActiveCallSummary(roomId);
  if (!createdCall.created) {
    chatServerDebug('call.start.raced-existing', {
      roomId,
      userId,
      callId: createdCall.callId,
    });
    return summary;
  }

  await createAuditLog({
    userId,
    organizationId: access.context.project.organizationId,
    action: 'chat.call_started',
    resourceType: 'call_session',
    resourceId: createdCall.callId,
    projectId: access.context.project.id,
    issueId: access.room.issueId || undefined,
    metadata: { roomId, livekitRoomName: createdCall.livekitRoomName },
  });

  await publishRoomEvent(roomId, {
    type: 'call.started',
    data: {
      roomId,
      call: summary,
    },
  });

  chatServerDebug('call.start.success', {
    roomId,
    userId,
    callId: createdCall.callId,
    livekitRoomName: createdCall.livekitRoomName,
    participantCount: summary?.participantCount || 0,
  });
  return summary;
}

export async function endConversationCall(roomId: string, userId: string) {
  const access = await resolveConversationRoomAccess(userId, roomId);
  if (!access) {
    throw new ChatAccessError('Conversation not found or unavailable.', 404);
  }

  const [call] = await db
    .select()
    .from(callSessions)
    .where(and(eq(callSessions.roomId, roomId), eq(callSessions.status, 'active')))
    .orderBy(desc(callSessions.startedAt))
    .limit(1);

  if (!call) {
    throw new ChatAccessError('No active call for this conversation.', 404);
  }

  const canEnd =
    access.context.permissions.canManageCalls ||
    access.context.permissions.canStartCalls ||
    call.startedBy === userId;
  if (!canEnd) {
    throw new ChatAccessError('You do not have permission to end this call.');
  }

  await finalizeActiveCallSession(call.id, {
    endedByUserId: userId,
    issueId: access.room.issueId,
    reason: 'manual_end',
  });
}

export async function leaveConversationCall(
  roomId: string,
  userId: string,
  participantIdentity?: string | null
) {
  chatServerDebug('call.leave.request', {
    roomId,
    userId,
    participantIdentity: participantIdentity || null,
  });
  const access = await resolveConversationRoomAccess(userId, roomId);
  if (!access) {
    throw new ChatAccessError('Conversation not found or unavailable.', 404);
  }

  const [call] = await db
    .select()
    .from(callSessions)
    .where(and(eq(callSessions.roomId, roomId), eq(callSessions.status, 'active')))
    .orderBy(desc(callSessions.startedAt))
    .limit(1);

  if (!call) {
    chatServerDebug('call.leave.no-active-call', {
      roomId,
      userId,
    });
    return null;
  }

  const now = new Date();
  await db
    .update(callParticipants)
    .set({
      leftAt: now,
    })
    .where(
      participantIdentity
        ? and(
            eq(callParticipants.callSessionId, call.id),
            eq(callParticipants.participantIdentity, participantIdentity),
            isNull(callParticipants.leftAt)
          )
        : and(
            eq(callParticipants.callSessionId, call.id),
            eq(callParticipants.userId, userId),
            isNull(callParticipants.leftAt)
          )
    );

  await db
    .update(callSessions)
    .set({
      updatedAt: now,
    })
    .where(eq(callSessions.id, call.id));

  const [remainingParticipants] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(callParticipants)
    .where(and(eq(callParticipants.callSessionId, call.id), isNull(callParticipants.leftAt)));

  if (Number(remainingParticipants?.count || 0) === 0) {
    chatServerDebug('call.leave.last-participant', {
      roomId,
      userId,
      callId: call.id,
    });
    await finalizeActiveCallSession(call.id, {
      endedByUserId: userId,
      issueId: access.room.issueId,
      reason: 'last_participant_left',
    });
    return null;
  }

  const summary = await getActiveCallSummary(roomId);
  if (!summary) {
    chatServerDebug('call.leave.summary-empty', {
      roomId,
      userId,
      callId: call.id,
    });
    return null;
  }

  await publishRoomEvent(roomId, {
    type: 'call.presence',
    data: {
      roomId,
      call: summary,
    },
  });

  return summary;
}

export async function touchConversationCallHeartbeat(
  roomId: string,
  userId: string,
  participantIdentity?: string | null
) {
  chatServerDebug('call.heartbeat.request', {
    roomId,
    userId,
    participantIdentity: participantIdentity || null,
  });
  const [call] = await db
    .select()
    .from(callSessions)
    .where(and(eq(callSessions.roomId, roomId), eq(callSessions.status, 'active')))
    .orderBy(desc(callSessions.startedAt))
    .limit(1);

  if (!call) {
    chatServerDebug('call.heartbeat.no-active-call', {
      roomId,
      userId,
    });
    return null;
  }

  const now = new Date();
  const [participant] = await db
    .select({
      id: callParticipants.id,
      metadata: callParticipants.metadata,
    })
    .from(callParticipants)
    .where(
      and(
        eq(callParticipants.callSessionId, call.id),
        participantIdentity
          ? eq(callParticipants.participantIdentity, participantIdentity)
          : eq(callParticipants.userId, userId),
        isNull(callParticipants.leftAt)
      )
    )
    .limit(1);

  if (!participant) {
    chatServerDebug('call.heartbeat.no-participant', {
      roomId,
      userId,
      callId: call.id,
      participantIdentity: participantIdentity || null,
    });
    return null;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(callParticipants)
      .set({
        metadata: buildCallParticipantHeartbeatMetadata(
          (participant.metadata as Record<string, unknown> | null | undefined) ?? undefined,
          now
        ),
      })
      .where(eq(callParticipants.id, participant.id));

    await tx
      .update(callSessions)
      .set({
        updatedAt: now,
      })
      .where(eq(callSessions.id, call.id));
  });

  return {
    callId: call.id,
    roomId: call.roomId,
    touchedAt: now,
  };
}

export async function createConversationCallToken(
  roomId: string,
  userId: string,
  options: { publicUrlOverride?: string; clientSessionId?: string | null } = {}
) {
  chatServerDebug('call.token.request', {
    roomId,
    userId,
    clientSessionId: options.clientSessionId || null,
    publicUrlOverride: options.publicUrlOverride || null,
  });
  const access = await resolveConversationRoomAccess(userId, roomId);
  if (!access) {
    throw new ChatAccessError('Conversation not found or unavailable.', 404);
  }

  if (!access.context.permissions.canBrowseChat) {
    throw new ChatAccessError('You do not have permission to join calls in this project.');
  }

  if (!access.context.effectiveSettings.voiceEnabled) {
    throw new ChatAccessError('Voice rooms are disabled in this project.');
  }

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let call = await getActiveCallSummary(roomId);
  if (!call && access.context.permissions.canStartCalls) {
    chatServerDebug('call.token.no-active-call-auto-start', {
      roomId,
      userId,
    });
    call = await startConversationCall(roomId, userId);
  }

  if (!call) {
    throw new ChatAccessError('Start a call before joining.', 409);
  }

  const status = getLivekitStatus();
  if (!status.ready) {
    throw new ChatAccessError(
      `LiveKit is not configured. Missing ${status.missing.join(', ')}.`,
      503
    );
  }

  const participantIdentity = buildLivekitParticipantIdentity(
    userId,
    options.clientSessionId?.trim() || createId()
  );

  const [existingParticipant] = await db
    .select({ id: callParticipants.id })
    .from(callParticipants)
    .where(
      and(
        eq(callParticipants.callSessionId, call.id),
        eq(callParticipants.participantIdentity, participantIdentity),
        isNull(callParticipants.leftAt)
      )
    )
    .limit(1);

  if (!existingParticipant) {
    const now = new Date();
    await db.transaction(async (tx) => {
      // A rejoin with a new clientSessionId produces a new participantIdentity,
      // which the participant-left webhook will never match — so without this
      // sweep the old row sits with leftAt=null and inflates the count.
      await tx
        .update(callParticipants)
        .set({ leftAt: now })
        .where(
          and(
            eq(callParticipants.callSessionId, call.id),
            eq(callParticipants.userId, userId),
            isNull(callParticipants.leftAt)
          )
        );

      await tx.insert(callParticipants).values({
        id: createId(),
        callSessionId: call.id,
        userId,
        participantIdentity,
        joinedAt: now,
        metadata: buildCallParticipantHeartbeatMetadata(
          {
            clientSessionId: options.clientSessionId?.trim() || null,
          },
          now
        ),
      });

      await tx
        .update(callSessions)
        .set({
          updatedAt: now,
        })
        .where(eq(callSessions.id, call.id));
    });
  }

  const token = await createLivekitToken({
    roomName: call.livekitRoomName,
    identity: participantIdentity,
    name: user?.name || user?.email || 'TaskNebula user',
    metadata: JSON.stringify({
      userId,
      clientSessionId: options.clientSessionId?.trim() || null,
    }),
    publicUrlOverride: options.publicUrlOverride,
  });

  await publishRoomEvent(roomId, {
    type: 'call.presence',
    data: {
      roomId,
      call: await getActiveCallSummary(roomId),
    },
  });

  chatServerDebug('call.token.success', {
    roomId,
    userId,
    callId: call.id,
    participantIdentity,
    roomName: call.livekitRoomName,
    publicUrl: token.url,
  });
  return {
    participantIdentity,
    roomName: call.livekitRoomName,
    token: token.token,
    url: token.url,
    call,
  };
}

async function getRoomReadStateMap(userId: string, roomIds: string[]) {
  if (roomIds.length === 0) {
    return new Map<string, { lastReadAt: Date; lastReadMessageId: string | null }>();
  }

  const readStates = await db
    .select()
    .from(roomReadStates)
    .where(and(eq(roomReadStates.userId, userId), inArray(roomReadStates.roomId, roomIds)));

  return new Map(
    readStates.map((state) => [
      state.roomId,
      {
        lastReadAt: state.lastReadAt,
        lastReadMessageId: state.lastReadMessageId,
      },
    ])
  );
}

async function getLatestMessagesByRoom(roomIds: string[]) {
  const messages = roomIds.length
    ? await db
        .select()
        .from(chatMessages)
        .where(inArray(chatMessages.roomId, roomIds))
        .orderBy(desc(chatMessages.createdAt))
    : [];

  const latestByRoom = new Map<string, typeof chatMessages.$inferSelect>();
  for (const message of messages) {
    if (!latestByRoom.has(message.roomId)) {
      latestByRoom.set(message.roomId, message);
    }
  }

  return latestByRoom;
}

export async function getProjectChatBootstrap(userId: string, projectIdOrKey: string) {
  const context = await getProjectChatContext(userId, projectIdOrKey);
  if (!context.canView) {
    throw new ChatAccessError('You do not have permission to view project chat.');
  }

  if (!context.effectiveSettings.enabled) {
    return {
      project: {
        id: context.project.id,
        key: context.project.key,
        name: context.project.name,
      },
      effectiveSettings: context.effectiveSettings,
      permissions: context.permissions,
      channels: [],
      recentDiscussions: [],
      activeCalls: [],
      lastActiveRoomId: null,
    };
  }

  const channels = await ensureDefaultProjectChannels({
    projectId: context.project.id,
    organizationId: context.project.organizationId,
    userId,
  });
  const roomRows = await db
    .select()
    .from(conversationRooms)
    .where(eq(conversationRooms.projectId, context.project.id))
    .orderBy(desc(conversationRooms.lastActivityAt));

  const roomIds = roomRows.map((room) => room.id);
  const readStateMap = await getRoomReadStateMap(userId, roomIds);
  const latestMessagesByRoom = await getLatestMessagesByRoom(roomIds);

  const activeCalls = await db
    .select()
    .from(callSessions)
    .where(and(eq(callSessions.projectId, context.project.id), eq(callSessions.status, 'active')))
    .orderBy(desc(callSessions.startedAt));

  const activeCallsByRoom = new Map(
    (
      await Promise.all(
        activeCalls.map(
          async (call) => [call.roomId, await getActiveCallSummary(call.roomId)] as const
        )
      )
    ).filter((entry) => entry[1])
  );

  const unreadCounts = new Map<string, number>();
  for (const room of roomRows) {
    const readState = readStateMap.get(room.id);
    const unreadCount = context.effectiveSettings.unreadTrackingEnabled
      ? await getUnreadCountForRoom(room.id, userId, readState?.lastReadAt || null)
      : 0;
    unreadCounts.set(room.id, unreadCount);
  }

  const channelItems = await Promise.all(
    channels.map(async (channel) => {
      const room = roomRows.find((entry) => entry.channelId === channel.id) || null;
      const presence = room ? await listRoomPresence(room.id) : [];
      const lastMessage = room ? latestMessagesByRoom.get(room.id) || null : null;
      return {
        ...channel,
        roomId: room?.id || null,
        unreadCount: room ? unreadCounts.get(room.id) || 0 : 0,
        participantCount: presence.length,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              body: lastMessage.deletedAt ? 'Message deleted' : lastMessage.body,
              createdAt: lastMessage.createdAt,
            }
          : null,
        activeCall: room ? activeCallsByRoom.get(room.id) || null : null,
      };
    })
  );

  const recentDiscussions = await Promise.all(
    roomRows
      .filter((room) => room.kind !== 'channel')
      .filter((room) => {
        if (room.kind === 'issue_thread') return context.effectiveSettings.issueThreadsEnabled;
        if (room.kind === 'document_thread')
          return context.effectiveSettings.documentThreadsEnabled;
        return true;
      })
      .slice(0, 8)
      .map(async (room) => {
        const contextRow = await buildConversationContext(room.id);
        const presence = await listRoomPresence(room.id);
        const latestMessage = latestMessagesByRoom.get(room.id) || null;

        return {
          ...room,
          unreadCount: unreadCounts.get(room.id) || 0,
          activeCall: activeCallsByRoom.get(room.id) || null,
          participantCount: presence.length,
          latestMessage: latestMessage
            ? {
                id: latestMessage.id,
                body: latestMessage.deletedAt ? 'Message deleted' : latestMessage.body,
                createdAt: latestMessage.createdAt,
              }
            : null,
          context: contextRow?.context || null,
        };
      })
  );

  const latestReadState = [...readStateMap.entries()].sort(
    (left, right) => right[1].lastReadAt.getTime() - left[1].lastReadAt.getTime()
  )[0];
  const fallbackRoom = roomRows.find((room) => room.kind === 'channel') || roomRows[0] || null;

  return {
    project: {
      id: context.project.id,
      key: context.project.key,
      name: context.project.name,
    },
    effectiveSettings: context.effectiveSettings,
    workspaceSettings: context.workspaceSettings,
    projectSettings: context.projectSettings,
    permissions: context.permissions,
    channels: channelItems,
    recentDiscussions,
    activeCalls: [...activeCallsByRoom.values()],
    lastActiveRoomId: latestReadState?.[0] || fallbackRoom?.id || null,
  };
}
