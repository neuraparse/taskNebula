import { createId } from '@paralleldrive/cuid2';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';
import { issues } from './issues';
import { documentPages } from './documents';

export const conversationRoomKindEnum = pgEnum('conversation_room_kind', [
  'channel',
  'issue_thread',
  'document_thread',
]);

export const callSessionStatusEnum = pgEnum('call_session_status', [
  'active',
  'ended',
]);

export const projectChannels = pgTable('project_channels', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull(),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  position: integer('position').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  updatedBy: text('updated_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
}, (table) => ({
  projectSlugIdx: uniqueIndex('project_channel_project_slug_idx').on(table.projectId, table.slug),
  projectPositionIdx: index('project_channel_project_position_idx').on(table.projectId, table.position),
  projectArchivedIdx: index('project_channel_project_archived_idx').on(table.projectId, table.isArchived),
  organizationIdx: index('project_channel_organization_idx').on(table.organizationId),
}));

export const conversationRooms = pgTable('conversation_rooms', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  kind: conversationRoomKindEnum('kind').notNull(),
  channelId: text('channel_id').references(() => projectChannels.id, { onDelete: 'cascade' }),
  issueId: text('issue_id').references(() => issues.id, { onDelete: 'cascade' }),
  documentPageId: text('document_page_id').references(() => documentPages.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }),
  lastMessageAt: timestamp('last_message_at'),
  lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  updatedBy: text('updated_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
}, (table) => ({
  channelIdx: uniqueIndex('conversation_room_channel_idx').on(table.channelId),
  issueIdx: uniqueIndex('conversation_room_issue_idx').on(table.issueId),
  documentIdx: uniqueIndex('conversation_room_document_idx').on(table.documentPageId),
  projectKindIdx: index('conversation_room_project_kind_idx').on(table.projectId, table.kind),
  organizationIdx: index('conversation_room_organization_idx').on(table.organizationId),
  lastActivityIdx: index('conversation_room_last_activity_idx').on(table.projectId, table.lastActivityAt),
}));

export const chatMessages = pgTable('chat_messages', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  roomId: text('room_id')
    .notNull()
    .references(() => conversationRooms.id, { onDelete: 'cascade' }),
  parentMessageId: text('parent_message_id').references((): any => chatMessages.id, { onDelete: 'cascade' }),
  body: text('body').notNull().default(''),
  bodyJson: jsonb('body_json').notNull().default('{}'),
  mentions: jsonb('mentions').notNull().default('[]'),
  attachments: jsonb('attachments').notNull().default('[]'),
  editedAt: timestamp('edited_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  updatedBy: text('updated_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
}, (table) => ({
  roomCreatedIdx: index('chat_message_room_created_idx').on(table.roomId, table.createdAt),
  roomParentIdx: index('chat_message_room_parent_idx').on(table.roomId, table.parentMessageId),
  projectIdx: index('chat_message_project_idx').on(table.projectId),
  organizationIdx: index('chat_message_organization_idx').on(table.organizationId),
  deletedIdx: index('chat_message_deleted_idx').on(table.deletedAt),
}));

export const chatMessageReactions = pgTable('chat_message_reactions', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  messageId: text('message_id')
    .notNull()
    .references(() => chatMessages.id, { onDelete: 'cascade' }),
  emoji: varchar('emoji', { length: 32 }).notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  messageEmojiUserIdx: uniqueIndex('chat_message_reaction_message_emoji_user_idx').on(
    table.messageId,
    table.emoji,
    table.userId
  ),
  messageIdx: index('chat_message_reaction_message_idx').on(table.messageId),
  userIdx: index('chat_message_reaction_user_idx').on(table.userId),
}));

export const roomReadStates = pgTable('room_read_states', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  roomId: text('room_id')
    .notNull()
    .references(() => conversationRooms.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lastReadMessageId: text('last_read_message_id').references(() => chatMessages.id, { onDelete: 'set null' }),
  lastReadAt: timestamp('last_read_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  roomUserIdx: uniqueIndex('room_read_state_room_user_idx').on(table.roomId, table.userId),
  userIdx: index('room_read_state_user_idx').on(table.userId),
}));

export const callSessions = pgTable('call_sessions', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  roomId: text('room_id')
    .notNull()
    .references(() => conversationRooms.id, { onDelete: 'cascade' }),
  livekitRoomName: varchar('livekit_room_name', { length: 255 }).notNull(),
  status: callSessionStatusEnum('status').notNull().default('active'),
  startedBy: text('started_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  endedBy: text('ended_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  roomStatusIdx: index('call_session_room_status_idx').on(table.roomId, table.status),
  projectStatusIdx: index('call_session_project_status_idx').on(table.projectId, table.status),
  livekitRoomIdx: uniqueIndex('call_session_livekit_room_idx').on(table.livekitRoomName),
}));

export const callParticipants = pgTable('call_participants', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  callSessionId: text('call_session_id')
    .notNull()
    .references(() => callSessions.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  leftAt: timestamp('left_at'),
  metadata: jsonb('metadata').notNull().default('{}'),
}, (table) => ({
  callIdx: index('call_participant_call_idx').on(table.callSessionId),
  userIdx: index('call_participant_user_idx').on(table.userId),
  activeIdx: index('call_participant_active_idx').on(table.callSessionId, table.leftAt),
}));
