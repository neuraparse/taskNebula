'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { removeById, upsertById } from '@/lib/chat/message-state';

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
  reactions: Array<{
    emoji: string;
    count: number;
    reactedUserIds: string[];
    reactedByCurrentUser: boolean;
  }>;
  optimistic?: boolean;
};

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
    staleTime: 15_000,
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
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
    staleTime: 2_000,
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useConversationMessages(roomId: string | undefined) {
  return useQuery({
    queryKey: ['conversation-messages', roomId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${roomId}/messages`);
      const payload = await response.json().catch(() => ({ error: 'Failed to load messages' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load messages');
      }
      return payload.messages as ConversationMessage[];
    },
    enabled: Boolean(roomId),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
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
        reactions: [],
        optimistic: true,
      };

      queryClient.setQueryData<ConversationMessage[]>(['conversation-messages', roomId], (current) =>
        upsertById(current, optimisticMessage)
      );

      return { tempId };
    },
    onError: (_error, _input, context) => {
      if (!roomId || !context?.tempId) {
        return;
      }

      queryClient.setQueryData<ConversationMessage[]>(['conversation-messages', roomId], (current) =>
        removeById(current, context.tempId as string)
      );
    },
    onSuccess: (message, _input, context) => {
      queryClient.setQueryData<ConversationMessage[]>(['conversation-messages', roomId], (current) => {
        const withoutTemp =
          roomId && context?.tempId ? removeById(current, context.tempId as string) : current || [];
        return upsertById(withoutTemp, message);
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
        queryClient.setQueryData<ConversationMessage[]>(['conversation-messages', roomId], (current) =>
          upsertById(current, message)
        );
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

      return payload;
    },
    onSuccess: (_payload, messageId) => {
      queryClient.setQueryData<ConversationMessage[]>(['conversation-messages', roomId], (current) =>
        removeById(current, messageId)
      );
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
    mutationFn: async () => {
      if (!roomId) {
        throw new Error('No room selected');
      }

      const response = await fetch(`/api/conversations/${roomId}/call/token`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to create call token' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create call token');
      }
      return payload as {
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

    const eventSource = new EventSource(`/api/conversations/${roomId}/stream`);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      if (!event.data) {
        return;
      }

      try {
        const payload = JSON.parse(event.data) as { type: string; data: Record<string, unknown> };
        if (payload.type === 'presence') {
          const nextPresence = (payload.data.participants as ConversationResponse['presence']) || [];
          setPresence((current) => (isSamePresenceList(current, nextPresence) ? current : nextPresence));
        }
        if (payload.type === 'call.started' || payload.type === 'call.presence') {
          const nextCall = (payload.data.call as Record<string, unknown>) || null;
          setActiveCall((current) => (isSameActiveCall(current, nextCall) ? current : nextCall));
        }
        if (payload.type === 'call.ended') {
          setActiveCall((current) => (current ? null : current));
        }
        if (payload.type === 'message.created' || payload.type === 'message.updated') {
          const message = payload.data.message as ConversationMessage | undefined;
          if (message) {
            queryClient.setQueryData<ConversationMessage[]>(['conversation-messages', roomId], (current) =>
              upsertById(current, message)
            );
          }
        }
        if (payload.type === 'message.deleted') {
          const messageId = payload.data.messageId;
          if (typeof messageId === 'string') {
            queryClient.setQueryData<ConversationMessage[]>(['conversation-messages', roomId], (current) =>
              removeById(current, messageId)
            );
          }
        }
        if (payload.type === 'message.reaction') {
          const messageId = payload.data.messageId;
          const reactions = payload.data.reactions as ConversationMessage['reactions'] | undefined;
          if (typeof messageId === 'string' && reactions) {
            queryClient.setQueryData<ConversationMessage[]>(['conversation-messages', roomId], (current) =>
              (current || []).map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      reactions,
                    }
                  : message
              )
            );
          }
        }
        if (
          payload.type === 'call.started' ||
          payload.type === 'call.ended' ||
          payload.type === 'call.presence'
        ) {
          queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
          queryClient.invalidateQueries({ queryKey: ['live-calls'] });
        }
      } catch {
        // Ignore malformed or transitional SSE payloads without polluting the browser console.
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
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
