'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { removeById, upsertById } from '@/lib/chat/message-state';
import { chatClientDebug, chatClientError } from '@/lib/chat/debug';

function mergeOlderMessages(current: ConversationMessage[], older: ConversationMessage[]) {
  if (!older.length) {
    return current;
  }

  const seen = new Set(current.map((message) => message.id));
  return [...older.filter((message) => !seen.has(message.id)), ...current];
}

function mergeLatestMessages(current: ConversationMessage[], latest: ConversationMessage[]) {
  if (!current.length) {
    return latest;
  }

  const latestIds = new Set(latest.map((message) => message.id));
  const olderTail = current.filter((message) => !latestIds.has(message.id));
  return [...olderTail, ...latest];
}

function isSameCallSummary(
  current:
    | ChatBootstrapResponse['activeCalls'][number]
    | GlobalLiveCall
    | Record<string, unknown>
    | null
    | undefined,
  next:
    | ChatBootstrapResponse['activeCalls'][number]
    | Record<string, unknown>
    | null
    | undefined
) {
  if (!current && !next) {
    return true;
  }

  if (!current || !next) {
    return false;
  }

  return (
    current.id === next.id &&
    current.roomId === next.roomId &&
    current.participantCount === next.participantCount &&
    current.livekitRoomName === next.livekitRoomName
  );
}

function patchBootstrapActiveCall(
  current: ChatBootstrapResponse | undefined,
  roomId: string,
  nextCall: Record<string, unknown> | null
) {
  if (!current) {
    return current;
  }

  let changed = false;
  const activeCall = nextCall
    ? ({
        id: String(nextCall.id || ''),
        roomId: String(nextCall.roomId || roomId),
        participantCount: Number(nextCall.participantCount || 0),
        livekitRoomName: String(nextCall.livekitRoomName || ''),
      } satisfies ChatBootstrapResponse['activeCalls'][number])
    : null;

  const channels = current.channels.map((channel) => {
    if (channel.roomId !== roomId) {
      return channel;
    }

    if (isSameCallSummary(channel.activeCall, activeCall)) {
      return channel;
    }

    changed = true;
    return {
      ...channel,
      activeCall,
    };
  });

  const recentDiscussions = current.recentDiscussions.map((discussion) => {
    if (discussion.id !== roomId) {
      return discussion;
    }

    if (isSameCallSummary(discussion.activeCall, activeCall)) {
      return discussion;
    }

    changed = true;
    return {
      ...discussion,
      activeCall,
    };
  });

  let activeCalls = current.activeCalls;
  if (activeCall) {
    const existingIndex = current.activeCalls.findIndex((call) => call.roomId === roomId);
    if (existingIndex >= 0) {
      if (!isSameCallSummary(current.activeCalls[existingIndex], activeCall)) {
        activeCalls = current.activeCalls.map((call, index) => (index === existingIndex ? activeCall : call));
        changed = true;
      }
    } else {
      activeCalls = [...current.activeCalls, activeCall];
      changed = true;
    }
  } else {
    const filtered = current.activeCalls.filter((call) => call.roomId !== roomId);
    if (filtered.length !== current.activeCalls.length) {
      activeCalls = filtered;
      changed = true;
    }
  }

  if (!changed) {
    return current;
  }

  return {
    ...current,
    channels,
    recentDiscussions,
    activeCalls,
  };
}

function patchLiveCalls(
  current: GlobalLiveCall[] | undefined,
  roomId: string,
  nextCall: Record<string, unknown> | null
) {
  if (!current) {
    return current;
  }

  if (!nextCall) {
    const filtered = current.filter((call) => call.roomId !== roomId);
    return filtered.length === current.length ? current : filtered;
  }

  const existingIndex = current.findIndex((call) => call.roomId === roomId);
  if (existingIndex < 0) {
    return current;
  }

  const existing = current[existingIndex];
  if (!existing) {
    return current;
  }
  if (isSameCallSummary(existing, nextCall)) {
    return current;
  }

  const updated = {
    ...existing,
    id: String(nextCall.id || existing.id),
    roomId: String(nextCall.roomId || existing.roomId),
    participantCount: Number(nextCall.participantCount || 0),
    livekitRoomName: String(nextCall.livekitRoomName || existing.livekitRoomName),
  } satisfies GlobalLiveCall;

  return current.map((call, index) => (index === existingIndex ? updated : call));
}

export type ChatBootstrapResponse = {
  project: {
    id: string;
    key: string;
    name: string;
  };
  effectiveSettings: {
    enabled: boolean;
    voiceEnabled: boolean;
    issueThreadsEnabled: boolean;
    documentThreadsEnabled: boolean;
    attachmentsEnabled: boolean;
    unreadTrackingEnabled: boolean;
  };
  workspaceSettings?: Record<string, unknown>;
  projectSettings?: Record<string, unknown>;
  permissions: {
    canBrowseProject: boolean;
    canAdministerProject: boolean;
    canBrowseChat: boolean;
    canCreateChannels: boolean;
    canPostMessages: boolean;
    canModerateMessages: boolean;
    canStartCalls: boolean;
    canManageCalls: boolean;
  };
  channels: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    roomId: string | null;
    unreadCount: number;
    participantCount: number;
    lastMessage: { id: string; body: string; createdAt: string } | null;
    activeCall: { id: string; participantCount: number } | null;
  }>;
  recentDiscussions: Array<{
    id: string;
    kind: 'issue_thread' | 'document_thread';
    title: string | null;
    unreadCount: number;
    participantCount: number;
    latestMessage: { id: string; body: string; createdAt: string } | null;
    activeCall: { id: string; participantCount: number } | null;
    context: Record<string, unknown> | null;
  }>;
  activeCalls: Array<{
    id: string;
    roomId: string;
    participantCount: number;
    livekitRoomName: string;
  }>;
  lastActiveRoomId: string | null;
};

export type GlobalLiveCall = {
  id: string;
  roomId: string;
  livekitRoomName: string;
  participantCount: number;
  startedAt: string;
  joinedParticipantId: string | null;
  isParticipant: boolean;
  project: {
    id: string;
    key: string;
    name: string;
    path: string;
  };
  room: {
    id: string;
    kind: 'channel' | 'issue_thread' | 'document_thread';
    title: string;
    subtitle: string;
    href: string;
  };
};

export type ConversationMessage = {
  id: string;
  roomId: string;
  body: string;
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    filePath: string;
    uploadedById: string;
    uploadedAt: string;
  }>;
  mentions: string[];
  deletedAt: string | null;
  editedAt: string | null;
  createdAt: string;
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
    deletedAttachments: Array<{
      id: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      filePath: string;
      uploadedById: string;
      uploadedAt: string;
    }>;
  } | null;
  reactions: Array<{
    emoji: string;
    count: number;
    reactedUserIds: string[];
    reactedByCurrentUser: boolean;
  }>;
  optimistic?: boolean;
};

type ConversationMessagesPage = {
  messages: ConversationMessage[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
};

type ConversationModerationAction = 'clear_deleted' | 'clear_room';

type ConversationResponse = {
  room: {
    id: string;
    kind: 'channel' | 'issue_thread' | 'document_thread';
    projectId: string;
  };
  context: Record<string, unknown> | null;
  messages: ConversationMessage[];
  presence: Array<{
    roomId: string;
    userId: string;
    name: string | null;
    image: string | null;
    lastSeenAt: string;
  }>;
  activeCall: Record<string, unknown> | null;
  effectiveSettings: ChatBootstrapResponse['effectiveSettings'];
  permissions: ChatBootstrapResponse['permissions'];
};

export function useProjectChatBootstrap(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-chat-bootstrap', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/chat/bootstrap`);
      const payload = await response.json().catch(() => ({ error: 'Failed to load chat bootstrap' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load chat bootstrap');
      }
      return payload as ChatBootstrapResponse;
    },
    enabled: Boolean(projectId),
    staleTime: 45_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useLiveCalls() {
  return useQuery({
    queryKey: ['live-calls'],
    queryFn: async () => {
      const response = await fetch('/api/chat/live-calls');
      const payload = await response.json().catch(() => ({ error: 'Failed to load live calls' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load live calls');
      }
      return payload.calls as GlobalLiveCall[];
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useConversationMessages(roomId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['conversation-messages', roomId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${roomId}/messages`);
      const payload = await response.json().catch(() => ({ error: 'Failed to load messages' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load messages');
      }
      return payload as ConversationMessagesPage;
    },
    enabled: Boolean(roomId),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageInfo = query.data?.pageInfo || { hasMore: false, nextCursor: null as string | null };

  const loadMore = async () => {
    if (!roomId || !pageInfo.hasMore || !pageInfo.nextCursor || isLoadingMore) {
      return;
    }

    try {
      setIsLoadingMore(true);
      const response = await fetch(
        `/api/conversations/${roomId}/messages?before=${encodeURIComponent(pageInfo.nextCursor)}`
      );
      const payload = await response.json().catch(() => ({ error: 'Failed to load older messages' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load older messages');
      }

      const nextPage = payload as ConversationMessagesPage;
      queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => ({
        messages: mergeOlderMessages(current?.messages || [], nextPage.messages),
        pageInfo: nextPage.pageInfo,
      }));
    } finally {
      setIsLoadingMore(false);
    }
  };

  return {
    ...query,
    data: query.data?.messages || [],
    pageInfo,
    hasMore: pageInfo.hasMore,
    isLoadingMore,
    loadMore,
  };
}

export function useIssueConversation(issueId: string | undefined) {
  return useQuery({
    queryKey: ['issue-conversation', issueId],
    queryFn: async () => {
      const response = await fetch(`/api/issues/${issueId}/conversation`);
      const payload = await response.json().catch(() => ({ error: 'Failed to load issue conversation' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load issue conversation');
      }
      return payload as ConversationResponse;
    },
    enabled: Boolean(issueId),
  });
}

export function useDocumentConversation(pageId: string | undefined) {
  return useQuery({
    queryKey: ['document-conversation', pageId],
    queryFn: async () => {
      const response = await fetch(`/api/docs/pages/${pageId}/conversation`);
      const payload = await response.json().catch(() => ({ error: 'Failed to load document conversation' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load document conversation');
      }
      return payload as ConversationResponse;
    },
    enabled: Boolean(pageId),
  });
}

export function useCreateConversationMessage(roomId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: { body: string; files?: File[]; parentMessageId?: string | null }) => {
      if (!roomId) {
        throw new Error('No room selected');
      }

      const hasFiles = input.files && input.files.length > 0;
      const response = await fetch(`/api/conversations/${roomId}/messages`, {
        method: 'POST',
        body: hasFiles
          ? (() => {
              const formData = new FormData();
              formData.set('body', input.body);
              if (input.parentMessageId) {
                formData.set('parentMessageId', input.parentMessageId);
              }
              input.files?.forEach((file) => formData.append('files', file));
              return formData;
            })()
          : JSON.stringify({ body: input.body, parentMessageId: input.parentMessageId || null }),
        headers: hasFiles ? undefined : { 'Content-Type': 'application/json' },
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to send message' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send message');
      }

      return payload.message as ConversationMessage;
    },
    onMutate: async (input) => {
      if (!roomId) {
        return { tempId: null as string | null };
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const now = new Date().toISOString();
      const optimisticMessage: ConversationMessage = {
        id: tempId,
        roomId,
        body: input.body,
        attachments: (input.files || []).map((file, index) => ({
          id: `${tempId}-file-${index}`,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          filePath: '',
          uploadedById: session?.user?.id || 'current-user',
          uploadedAt: now,
        })),
        mentions: [],
        deletedAt: null,
        editedAt: null,
        createdAt: now,
        author: {
          id: session?.user?.id || 'current-user',
          name: session?.user?.name || session?.user?.email || 'You',
          email: session?.user?.email || null,
          image: session?.user?.image || null,
        },
        canDelete: true,
        canEdit: true,
        moderation: null,
        reactions: [],
        optimistic: true,
      };

      queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => ({
        messages: upsertById(current?.messages, optimisticMessage),
        pageInfo: current?.pageInfo || { hasMore: false, nextCursor: null },
      }));

      return { tempId };
    },
    onError: (_error, _input, context) => {
      if (!roomId || !context?.tempId) {
        return;
      }

      queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => ({
        messages: removeById(current?.messages, context.tempId as string),
        pageInfo: current?.pageInfo || { hasMore: false, nextCursor: null },
      }));
    },
    onSuccess: (message, _input, context) => {
      queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => {
        const withoutTemp =
          roomId && context?.tempId
            ? removeById(current?.messages, context.tempId as string)
            : current?.messages || [];
        return {
          messages: upsertById(withoutTemp, message),
          pageInfo: current?.pageInfo || { hasMore: false, nextCursor: null },
        };
      });
      queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['issue-conversation'] });
      queryClient.invalidateQueries({ queryKey: ['document-conversation'] });
    },
  });
}

export function useUpdateConversationMessage(roomId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { messageId: string; body?: string; reactionEmoji?: string }) => {
      if (!roomId) {
        throw new Error('No room selected');
      }

      const response = await fetch(`/api/conversations/${roomId}/messages/${input.messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to update message' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update message');
      }
      return payload.message as ConversationMessage | null;
    },
    onSuccess: (message) => {
      if (message) {
        queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => ({
          messages: upsertById(current?.messages, message),
          pageInfo: current?.pageInfo || { hasMore: false, nextCursor: null },
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['issue-conversation'] });
      queryClient.invalidateQueries({ queryKey: ['document-conversation'] });
    },
  });
}

export function useDeleteConversationMessage(roomId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      if (!roomId) {
        throw new Error('No room selected');
      }

      const response = await fetch(`/api/conversations/${roomId}/messages/${messageId}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to delete message' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete message');
      }

      return payload.message as ConversationMessage | null;
    },
    onSuccess: (message, messageId) => {
      queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => ({
        messages: message
          ? upsertById(current?.messages, message)
          : removeById(current?.messages, messageId),
        pageInfo: current?.pageInfo || { hasMore: false, nextCursor: null },
      }));
      queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['issue-conversation'] });
      queryClient.invalidateQueries({ queryKey: ['document-conversation'] });
    },
  });
}

export function useModerateConversationMessages(roomId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: ConversationModerationAction) => {
      const response = await fetch(`/api/conversations/${roomId}/messages/moderation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response
        .json()
        .catch(() => ({ error: 'Failed to moderate conversation messages' }));

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to moderate conversation messages');
      }

      return payload as { action: ConversationModerationAction; affectedCount: number };
    },
    onSuccess: ({ action }) => {
      queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => {
        if (action === 'clear_room') {
          return {
            messages: [],
            pageInfo: { hasMore: false, nextCursor: null },
          };
        }

        return {
          messages: (current?.messages || []).filter((message) => !message.deletedAt),
          pageInfo: current?.pageInfo || { hasMore: false, nextCursor: null },
        };
      });
      queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['issue-conversation'] });
      queryClient.invalidateQueries({ queryKey: ['document-conversation'] });
    },
  });
}

export function useMarkConversationRead(roomId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lastReadMessageId?: string | null) => {
      if (!roomId) {
        throw new Error('No room selected');
      }

      const response = await fetch(`/api/conversations/${roomId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastReadMessageId: lastReadMessageId || null }),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to mark conversation as read' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to mark conversation as read');
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
    },
  });
}

export function useStartConversationCall(roomId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!roomId) {
        throw new Error('No room selected');
      }

      const response = await fetch(`/api/conversations/${roomId}/call/start`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to start call' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to start call');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['issue-conversation'] });
      queryClient.invalidateQueries({ queryKey: ['document-conversation'] });
    },
  });
}

export function useEndConversationCall(roomId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!roomId) {
        throw new Error('No room selected');
      }

      const response = await fetch(`/api/conversations/${roomId}/call/end`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to end call' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to end call');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
    },
  });
}

export function useLeaveConversationCall(roomId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!roomId) {
        throw new Error('No room selected');
      }

      const response = await fetch(`/api/conversations/${roomId}/call/leave`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to leave call' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to leave call');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['issue-conversation'] });
      queryClient.invalidateQueries({ queryKey: ['document-conversation'] });
    },
  });
}

export function useCallToken(roomId: string | undefined) {
  return useMutation({
    mutationFn: async (input?: { clientSessionId?: string }) => {
      if (!roomId) {
        throw new Error('No room selected');
      }

      const response = await fetch(`/api/conversations/${roomId}/call/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientSessionId: input?.clientSessionId || null,
        }),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to create call token' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create call token');
      }
      return payload as {
        participantIdentity: string;
        roomName: string;
        token: string;
        url: string;
        call: Record<string, unknown>;
      };
    },
  });
}

export function useConversationStream(roomId: string | undefined, enabled: boolean) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState<ConversationResponse['presence']>([]);
  const [activeCall, setActiveCall] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!roomId || !enabled) {
      return;
    }

    chatClientDebug('chat-stream.connect.start', {
      roomId,
      enabled,
    });
    const eventSource = new EventSource(`/api/conversations/${roomId}/stream`);

    eventSource.onopen = () => {
      chatClientDebug('chat-stream.connect.open', {
        roomId,
      });
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      if (!event.data) {
        return;
      }

      let payload: { type: string; data: Record<string, unknown> };
      try {
        payload = JSON.parse(event.data) as { type: string; data: Record<string, unknown> };
      } catch (err) {
        console.warn('chat-stream: failed to parse SSE payload', err);
        return;
      }

      try {
        chatClientDebug('chat-stream.message', {
          roomId,
          type: payload.type,
          data: payload.type.startsWith('call.')
            ? payload.data
            : {
                roomId: payload.data.roomId,
                messageId: payload.data.messageId,
                action: payload.data.action,
              },
        });
        if (payload.type === 'presence') {
          const nextPresence = (payload.data.participants as ConversationResponse['presence']) || [];
          setPresence((current) => (isSamePresenceList(current, nextPresence) ? current : nextPresence));
        }
        if (payload.type === 'call.started' || payload.type === 'call.presence') {
          const nextCall = (payload.data.call as Record<string, unknown>) || null;
          setActiveCall((current) => (isSameActiveCall(current, nextCall) ? current : nextCall));
          queryClient.setQueriesData<ChatBootstrapResponse>(
            { queryKey: ['project-chat-bootstrap'] },
            (current) => patchBootstrapActiveCall(current, roomId, nextCall)
          );
          if (payload.type === 'call.started') {
            queryClient.invalidateQueries({ queryKey: ['live-calls'] });
          } else {
            queryClient.setQueryData<GlobalLiveCall[]>(
              ['live-calls'],
              (current) => patchLiveCalls(current, roomId, nextCall)
            );
          }
        }
        if (payload.type === 'call.ended') {
          setActiveCall((current) => (current ? null : current));
          queryClient.setQueriesData<ChatBootstrapResponse>(
            { queryKey: ['project-chat-bootstrap'] },
            (current) => patchBootstrapActiveCall(current, roomId, null)
          );
          queryClient.setQueryData<GlobalLiveCall[]>(
            ['live-calls'],
            (current) => patchLiveCalls(current, roomId, null)
          );
        }
        if (payload.type === 'message.created' || payload.type === 'message.updated') {
          const message = payload.data.message as ConversationMessage | undefined;
          if (message) {
            queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => ({
              messages: upsertById(current?.messages, message),
              pageInfo: current?.pageInfo || { hasMore: false, nextCursor: null },
            }));
          }
        }
        if (payload.type === 'message.deleted') {
          const messageId = typeof payload.data.messageId === 'string' ? payload.data.messageId : null;
          if (messageId) {
            queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => ({
              messages: (current?.messages || []).map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      body: '',
                      attachments: [],
                      deletedAt: message.deletedAt || new Date().toISOString(),
                      canDelete: false,
                      canEdit: false,
                    }
                  : message
              ),
              pageInfo: current?.pageInfo || { hasMore: false, nextCursor: null },
            }));
          }

          void fetch(`/api/conversations/${roomId}/messages?limit=40`)
            .then((response) =>
              response
                .json()
                .catch(() => ({ error: 'Failed to refresh messages' }))
                .then((json) => ({ ok: response.ok, json }))
            )
            .then(({ ok, json }) => {
              if (!ok) {
                return;
              }

              const latestPage = json as ConversationMessagesPage;
              queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => ({
                messages: mergeLatestMessages(current?.messages || [], latestPage.messages),
                pageInfo: current?.pageInfo || latestPage.pageInfo,
              }));
            })
            .catch(() => {
              // Ignore best-effort refresh failures.
            });
        }
        if (payload.type === 'message.reaction') {
          const messageId = payload.data.messageId;
          const reactions = payload.data.reactions as ConversationMessage['reactions'] | undefined;
          if (typeof messageId === 'string' && reactions) {
            queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => ({
              messages: (current?.messages || []).map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      reactions,
                    }
                  : message
              ),
              pageInfo: current?.pageInfo || { hasMore: false, nextCursor: null },
            }));
          }
        }
        if (payload.type === 'messages.cleared') {
          const action = payload.data.action as ConversationModerationAction | undefined;
          void fetch(`/api/conversations/${roomId}/messages?limit=40`)
            .then((response) =>
              response
                .json()
                .catch(() => ({ error: 'Failed to refresh messages' }))
                .then((json) => ({ ok: response.ok, json }))
            )
            .then(({ ok, json }) => {
              if (!ok) {
                return;
              }

              const latestPage = json as ConversationMessagesPage;
              queryClient.setQueryData<ConversationMessagesPage>(['conversation-messages', roomId], (current) => ({
                messages:
                  action === 'clear_room'
                    ? latestPage.messages
                    : mergeLatestMessages(
                        (current?.messages || []).filter((message) => !message.deletedAt),
                        latestPage.messages
                      ),
                pageInfo: latestPage.pageInfo,
              }));
            })
            .catch(() => {
              // Ignore best-effort refresh failures.
            });
        }
      } catch {
        // Ignore malformed or transitional SSE payloads without polluting the browser console.
      }
    };

    eventSource.onerror = () => {
      chatClientError('chat-stream.connect.error', {
        roomId,
        readyState: eventSource.readyState,
      });
      setIsConnected(false);
    };

    return () => {
      chatClientDebug('chat-stream.connect.close', {
        roomId,
        readyState: eventSource.readyState,
      });
      eventSource.close();
      setIsConnected(false);
    };
  }, [enabled, queryClient, roomId]);

  return useMemo(
    () => ({
      isConnected,
      presence,
      activeCall,
    }),
    [activeCall, isConnected, presence]
  );
}

function isSamePresenceList(
  current: ConversationResponse['presence'],
  next: ConversationResponse['presence']
) {
  if (current.length !== next.length) {
    return false;
  }

  return current.every((entry, index) => {
    const nextEntry = next[index];
    return (
      entry.roomId === nextEntry?.roomId &&
      entry.userId === nextEntry?.userId &&
      entry.name === nextEntry?.name &&
      entry.image === nextEntry?.image
    );
  });
}

function isSameActiveCall(
  current: Record<string, unknown> | null,
  next: Record<string, unknown> | null
) {
  if (!current && !next) {
    return true;
  }
  if (!current || !next) {
    return false;
  }

  return (
    current.id === next.id &&
    current.roomId === next.roomId &&
    current.participantCount === next.participantCount &&
    current.livekitRoomName === next.livekitRoomName
  );
}

export function useWorkspaceCommunicationsSettings(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['workspace-communications', organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organizationId}/communications`);
      const payload = await response.json().catch(() => ({ error: 'Failed to load workspace communications' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load workspace communications');
      }
      return payload as {
        organizationId: string;
        organizationName: string;
        settings: Record<string, boolean>;
        serviceStatus: {
          redisReady: boolean;
          livekit: {
            ready: boolean;
            url: string | null;
            missing: string[];
          };
        };
      };
    },
    enabled: Boolean(organizationId),
  });
}

export function useUpdateWorkspaceCommunicationsSettings(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, boolean>) => {
      if (!organizationId) {
        throw new Error('No organization selected');
      }
      const response = await fetch(`/api/organizations/${organizationId}/communications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to update workspace communications' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update workspace communications');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-communications', organizationId] });
    },
  });
}

export function useProjectCommunicationsSettings(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-communications', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/communications`);
      const payload = await response.json().catch(() => ({ error: 'Failed to load project communications' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load project communications');
      }
      return payload as {
        project: { id: string; key: string; name: string };
        access: { canView: boolean; canManage: boolean };
        workspaceSettings: Record<string, boolean>;
        projectSettings: Record<string, boolean>;
        effectiveSettings: Record<string, boolean>;
      };
    },
    enabled: Boolean(projectId),
  });
}

export function useUpdateProjectCommunicationsSettings(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, boolean>) => {
      if (!projectId) {
        throw new Error('No project selected');
      }

      const response = await fetch(`/api/projects/${projectId}/communications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to update project communications' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update project communications');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-communications', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap', projectId] });
    },
  });
}

export function useRealtimeHealth() {
  return useQuery({
    queryKey: ['admin-realtime-health'],
    queryFn: async () => {
      const response = await fetch('/api/admin/realtime-health');
      const payload = await response.json().catch(() => ({ error: 'Failed to load realtime health' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load realtime health');
      }
      return payload as {
        services: {
          redis: { ready: boolean; mode: string };
          livekit: { ready: boolean; url: string | null; missing: string[] };
        };
        stats: {
          channels: number;
          rooms: number;
          activeCalls: number;
          readStates: number;
        };
      };
    },
  });
}
