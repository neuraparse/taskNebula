import type { AuditableEntity, ID } from './common';

export type ConversationRoomKind = 'channel' | 'issue_thread' | 'document_thread';
export type CallSessionStatus = 'active' | 'ended';

export interface ProjectChannel extends AuditableEntity {
  organizationId: ID;
  projectId: ID;
  name: string;
  slug: string;
  description?: string | null;
  isDefault: boolean;
  position: number;
  isArchived: boolean;
}

export interface ConversationRoom extends AuditableEntity {
  organizationId: ID;
  projectId: ID;
  kind: ConversationRoomKind;
  channelId?: ID | null;
  issueId?: ID | null;
  documentPageId?: ID | null;
  title?: string | null;
  lastMessageAt?: string | Date | null;
  lastActivityAt: string | Date;
}

export interface ChatMessage extends AuditableEntity {
  organizationId: ID;
  projectId: ID;
  roomId: ID;
  parentMessageId?: ID | null;
  body: string;
  bodyJson: Record<string, unknown>;
  mentions: ID[];
  attachments: ChatMessageAttachment[];
  editedAt?: string | Date | null;
  deletedAt?: string | Date | null;
}

export interface ChatMessageAttachment {
  id: ID;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  uploadedById: ID;
  uploadedAt: string | Date;
}

export interface ChatReaction {
  id: ID;
  messageId: ID;
  emoji: string;
  userId: ID;
  createdAt: string | Date;
}

export interface RoomUnreadState {
  roomId: ID;
  userId: ID;
  unreadCount: number;
  lastReadMessageId?: ID | null;
  lastReadAt: string | Date;
}

export interface RoomPresence {
  roomId: ID;
  userId: ID;
  name: string | null;
  image?: string | null;
  status: 'active';
  lastSeenAt: string | Date;
}

export interface CallSession {
  id: ID;
  organizationId: ID;
  projectId: ID;
  roomId: ID;
  livekitRoomName: string;
  status: CallSessionStatus;
  startedBy: ID;
  startedAt: string | Date;
  endedAt?: string | Date | null;
  endedBy?: ID | null;
}
