'use client';

import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  RoomContext,
  RoomAudioRenderer,
  setLogLevel as setLiveKitLogLevel,
  useAudioPlayback,
  useConnectionState,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTrackToggle,
} from '@livekit/components-react';
import {
  LogLevel,
  Room,
  RoomEvent,
  Track,
  setLogLevel as setLiveKitClientLogLevel,
  type Participant,
} from 'livekit-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { ChatBootstrapResponse, ConversationMessage } from '@/lib/hooks/use-chat';
import {
  useCallToken,
  useConversationMessages,
  useConversationStream,
  useCreateConversationMessage,
  useEndConversationCall,
  useLeaveConversationCall,
  useMarkConversationRead,
  useProjectChatBootstrap,
  useStartConversationCall,
  useUpdateConversationMessage,
  useLiveCalls,
} from '@/lib/hooks/use-chat';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Hash,
  ImagePlus,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  PanelLeft,
  PhoneCall,
  PhoneOff,
  SendHorizontal,
  Volume2,
  TestTube2,
  Users2,
  X,
} from 'lucide-react';
import { useGlobalVoice } from '@/components/chat/global-voice-provider';

const QUICK_REACTIONS = ['👍', '👀', '🚀'];
const DEFAULT_MIC_CAPTURE_OPTIONS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;

function createVoiceRoom() {
  return new Room({
    adaptiveStream: false,
    dynacast: false,
    disconnectOnPageLeave: false,
    singlePeerConnection: false,
  });
}

type LivekitSession = {
  url: string;
  token: string;
  roomName: string;
  audioDeviceId: string;
  startWithMicrophone: boolean;
};

type PreparedVoiceSession = {
  roomId: string;
  url: string;
  token: string;
  roomName: string;
};

export function ChatShell({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const voice = useGlobalVoice();
  const [composerValue, setComposerValue] = useState('');
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [preparedVoiceSession, setPreparedVoiceSession] = useState<PreparedVoiceSession | null>(null);
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false);
  const [isVoiceSetupOpen, setIsVoiceSetupOpen] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isJoiningCall, setIsJoiningCall] = useState(false);
  const [isPreparingVoiceSetup, setIsPreparingVoiceSetup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const sendLockRef = useRef(false);
  const joinCallLockRef = useRef(false);
  const lastReadMarkerRef = useRef<string | null>(null);

  useEffect(() => {
    // Keep browser consoles usable. We surface actionable voice errors in the UI instead.
    setLiveKitLogLevel(LogLevel.silent);
    setLiveKitClientLogLevel(LogLevel.silent);
  }, []);

  const selectedRoomId = searchParams.get('roomId');
  const { data: bootstrap, isLoading, error, refetch } = useProjectChatBootstrap(projectId);
  const { data: liveCalls } = useLiveCalls();
  const messagesQuery = useConversationMessages(selectedRoomId || undefined);
  const createMessage = useCreateConversationMessage(selectedRoomId || undefined);
  const reactToMessage = useUpdateConversationMessage(selectedRoomId || undefined);
  const markRead = useMarkConversationRead(selectedRoomId || undefined);
  const startCall = useStartConversationCall(selectedRoomId || undefined);
  const endCall = useEndConversationCall(selectedRoomId || undefined);
  const leaveCall = useLeaveConversationCall(selectedRoomId || undefined);
  const callToken = useCallToken(selectedRoomId || undefined);
  const stream = useConversationStream(selectedRoomId || undefined, Boolean(selectedRoomId));

  const selectedRoomMeta = useMemo(() => {
    const channel = bootstrap?.channels.find((entry) => entry.roomId === selectedRoomId);
    if (channel) {
      return {
        id: channel.roomId!,
        title: channel.name,
        subtitle: channel.description || 'Project channel',
        kind: 'channel' as const,
        activeCall: channel.activeCall || null,
      };
    }

    const discussion = bootstrap?.recentDiscussions.find((entry) => entry.id === selectedRoomId);
    if (discussion) {
      return {
        id: discussion.id,
        title:
          typeof discussion.context?.title === 'string'
            ? discussion.context.title
            : discussion.title || 'Discussion',
        subtitle:
          discussion.kind === 'issue_thread'
            ? (discussion.context?.key as string | undefined) || 'Issue discussion'
            : 'Document discussion',
        kind: discussion.kind,
        activeCall: discussion.activeCall || null,
      };
    }

    return null;
  }, [bootstrap?.channels, bootstrap?.recentDiscussions, selectedRoomId]);

  const messageList = messagesQuery.data || [];
  const currentVoiceRoomId = voice.currentTarget?.roomId || null;
  const isCurrentVoiceRoom = Boolean(selectedRoomId && currentVoiceRoomId === selectedRoomId);
  const globalSelectedRoomCall =
    liveCalls?.find((call) => call.roomId === selectedRoomId) || null;
  const localSelectedRoomCall =
    isCurrentVoiceRoom && voice.currentSession
      ? {
          id: voice.currentSession.roomName,
          participantCount: voice.participantCount || 1,
        }
      : null;
  const combinedActiveCall =
    localSelectedRoomCall ||
    (stream.activeCall as Record<string, unknown> | null) ||
    globalSelectedRoomCall ||
    selectedRoomMeta?.activeCall ||
    null;
  const trimmedComposerValue = composerValue.trim();
  const lastReadableMessageId =
    messageList.length > 0 && !messageList[messageList.length - 1]?.optimistic
      ? messageList[messageList.length - 1]?.id || null
      : null;
  const canSendMessages = Boolean(selectedRoomId && bootstrap?.permissions.canPostMessages);
  const attachmentsEnabled = Boolean(bootstrap?.effectiveSettings.attachmentsEnabled);
  const sendDisabledReason = !selectedRoomId
    ? 'Choose a conversation first.'
    : !bootstrap?.permissions.canPostMessages
      ? 'You do not have permission to send messages here.'
      : queuedFiles.length > 0 && !attachmentsEnabled
        ? 'Attachments are disabled in this project.'
        : null;

  useEffect(() => {
    if (!selectedRoomId && bootstrap?.lastActiveRoomId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('roomId', bootstrap.lastActiveRoomId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [bootstrap?.lastActiveRoomId, pathname, router, searchParams, selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId || !bootstrap?.effectiveSettings.unreadTrackingEnabled || !lastReadableMessageId) {
      return;
    }

    const nextMarker = `${selectedRoomId}:${lastReadableMessageId}`;
    if (lastReadMarkerRef.current === nextMarker) {
      return;
    }

    lastReadMarkerRef.current = nextMarker;
    markRead.mutate(lastReadableMessageId, {
      onError: () => {
        if (lastReadMarkerRef.current === nextMarker) {
          lastReadMarkerRef.current = null;
        }
      },
    });
  }, [bootstrap?.effectiveSettings.unreadTrackingEnabled, lastReadableMessageId, markRead.mutate, selectedRoomId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messageList.length, selectedRoomId]);

  useEffect(() => {
    setComposerError(null);
    setCallError(null);
    setQueuedFiles([]);
    setComposerValue('');
    setPreparedVoiceSession(null);
    setIsVoiceSetupOpen(false);
    lastReadMarkerRef.current = null;
    sendLockRef.current = false;
    joinCallLockRef.current = false;
    setIsSendingMessage(false);
    setIsJoiningCall(false);
    setIsPreparingVoiceSetup(false);
  }, [selectedRoomId]);

  async function handleCreateChannel() {
    try {
      const response = await fetch(`/api/projects/${projectId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChannelName,
          description: newChannelDescription || null,
        }),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to create channel' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create channel');
      }

      setIsCreateChannelOpen(false);
      setNewChannelName('');
      setNewChannelDescription('');
      toast({
        title: 'Channel created',
        description: `${payload.channel.name} is ready.`,
      });
      await refetch();
      if (payload.room?.id) {
        selectRoom(payload.room.id);
      }
    } catch (mutationError) {
      toast({
        title: 'Failed to create channel',
        description: mutationError instanceof Error ? mutationError.message : 'Failed to create channel',
        variant: 'destructive',
      });
    }
  }

  function selectRoom(roomId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('roomId', roomId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function queueFiles(files: File[]) {
    if (!files.length) {
      return;
    }

    if (!attachmentsEnabled) {
      const errorMessage = 'Attachments are disabled in this project.';
      setComposerError(errorMessage);
      toast({
        title: 'Attachments unavailable',
        description: errorMessage,
        variant: 'destructive',
      });
      return;
    }

    setComposerError(null);
    setQueuedFiles((current) => [...current, ...files]);
  }

  async function handleSendMessage() {
    if (sendLockRef.current || isSendingMessage) {
      return;
    }

    if (!selectedRoomId || !canSendMessages) {
      setComposerError(sendDisabledReason || 'You cannot send messages right now.');
      return;
    }

    if (!trimmedComposerValue && queuedFiles.length === 0) {
      return;
    }

    if (queuedFiles.length > 0 && !attachmentsEnabled) {
      setComposerError('Attachments are disabled in this project.');
      return;
    }

    try {
      sendLockRef.current = true;
      setIsSendingMessage(true);
      setComposerError(null);
      await createMessage.mutateAsync({
        body: trimmedComposerValue,
        files: queuedFiles,
      });
      setComposerValue('');
      setQueuedFiles([]);
    } catch (mutationError) {
      const description =
        mutationError instanceof Error ? mutationError.message : 'Failed to send message';
      setComposerError(description);
      toast({
        title: 'Failed to send message',
        description,
        variant: 'destructive',
      });
    } finally {
      sendLockRef.current = false;
      setIsSendingMessage(false);
    }
  }

  function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSendMessage();
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    try {
      await reactToMessage.mutateAsync({ messageId, reactionEmoji: emoji });
    } catch (mutationError) {
      toast({
        title: 'Failed to update reaction',
        description: mutationError instanceof Error ? mutationError.message : 'Failed to update reaction',
        variant: 'destructive',
      });
    }
  }

  async function prepareVoiceSession(roomId: string) {
    if (preparedVoiceSession?.roomId === roomId) {
      return preparedVoiceSession;
    }

    if (!combinedActiveCall) {
      await startCall.mutateAsync();
    }

    let token;
    try {
      token = await callToken.mutateAsync();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('start a call before joining') || message.includes('no active call')) {
        await startCall.mutateAsync();
        token = await callToken.mutateAsync();
      } else {
        throw error;
      }
    }

    const nextPreparedSession = {
      roomId,
      url: token.url,
      token: token.token,
      roomName: token.roomName,
    } satisfies PreparedVoiceSession;

    setPreparedVoiceSession(nextPreparedSession);
    return nextPreparedSession;
  }

  function handleOpenVoiceSetup() {
    if (!selectedRoomId || isJoiningCall || voice.currentSession || isPreparingVoiceSetup) {
      return;
    }

    setCallError(null);
    setIsVoiceSetupOpen(true);
    setIsVoicePanelOpen(true);
    setIsPreparingVoiceSetup(true);
    void prepareVoiceSession(selectedRoomId)
      .catch((mutationError) => {
        const description =
          mutationError instanceof Error ? mutationError.message : 'Failed to prepare the voice room';
        setCallError(description);
      })
      .finally(() => {
        setIsPreparingVoiceSetup(false);
      });
  }

  async function handleJoinCall(options: {
    audioDeviceId: string;
    startWithMicrophone: boolean;
  }) {
    if (!selectedRoomId || joinCallLockRef.current || voice.currentSession) {
      return;
    }

    try {
      joinCallLockRef.current = true;
      setIsJoiningCall(true);
      setCallError(null);

      const preparedSession =
        preparedVoiceSession?.roomId === selectedRoomId
          ? preparedVoiceSession
          : await prepareVoiceSession(selectedRoomId);

      voice.startSession({
        session: {
          url: preparedSession.url,
          token: preparedSession.token,
          roomName: preparedSession.roomName,
          audioDeviceId: options.audioDeviceId,
          startWithMicrophone: options.startWithMicrophone,
        },
        target: {
          roomId: selectedRoomId,
          roomTitle: selectedRoomMeta?.title || 'Voice room',
          roomSubtitle: selectedRoomMeta?.subtitle || 'Project conversation',
          roomHref: `/projects/${projectId}/chat?roomId=${selectedRoomId}`,
          projectName: bootstrap.project.name,
          projectPath: bootstrap.project.key.toLowerCase(),
          canManageCalls: bootstrap.permissions.canManageCalls,
        },
      });
      setIsVoiceSetupOpen(false);
      setIsVoicePanelOpen(false);
      setPreparedVoiceSession(null);
    } catch (mutationError) {
      const description =
        mutationError instanceof Error ? mutationError.message : 'Failed to join call';
      setCallError(description);
      toast({
        title: 'Failed to join call',
        description,
        variant: 'destructive',
      });
    } finally {
      joinCallLockRef.current = false;
      setIsJoiningCall(false);
    }
  }

  const handleCloseVoicePanel = useCallback(() => {
    setPreparedVoiceSession(null);
    setIsVoiceSetupOpen(false);
    setIsVoicePanelOpen(false);
  }, []);

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files || []);
    if (files.length) {
      event.preventDefault();
      queueFiles(files);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading chat…
        </div>
      </div>
    );
  }

  if (error || !bootstrap) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Chat is unavailable</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : 'Failed to load project chat.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!bootstrap.effectiveSettings.enabled) {
    return (
      <div className="p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Chat & Calls are disabled</CardTitle>
            <CardDescription>
              Enable communications in workspace or project settings to use channels, issue discussions, and voice rooms.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={`/projects/${projectId}/settings?tab=chat-calls`}>Project settings</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/settings?tab=communications">Workspace settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sidebar = (
    <ChatSidebar
      bootstrap={bootstrap}
      selectedRoomId={selectedRoomId}
      onCreateChannel={() => setIsCreateChannelOpen(true)}
      onSelectRoom={(roomId) => {
        setIsSidebarOpen(false);
        selectRoom(roomId);
      }}
    />
  );

  return (
    <>
      <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create channel</DialogTitle>
            <DialogDescription>Add a focused room for a release stream, team function, or incident lane.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={newChannelName} onChange={(event) => setNewChannelName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newChannelDescription}
                onChange={(event) => setNewChannelDescription(event.target.value)}
                className="min-h-[96px]"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreateChannel} disabled={!newChannelName.trim()}>
                Create channel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="w-[320px] p-0">
          <SheetHeader className="border-b px-4 py-4 text-left">
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex h-full min-h-0 bg-background">
        <aside className="hidden h-full w-[280px] shrink-0 border-r lg:flex">{sidebar}</aside>

        <main className="flex min-w-0 flex-1">
          {selectedRoomMeta ? (
            <>
              <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                <div className="min-w-0 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-md lg:hidden"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {selectedRoomMeta.kind === 'channel' ? (
                        <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <MessageSquareText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="truncate text-sm font-semibold sm:text-base">{selectedRoomMeta.title}</div>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {selectedRoomMeta.subtitle}
                      {combinedActiveCall ? ` · ${Number(combinedActiveCall.participantCount) || 0} in call` : ''}
                      {stream.presence.length ? ` · ${stream.presence.length} online` : ''}
                      {!stream.isConnected ? ' · reconnecting' : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {voice.currentSession ? (
                    <Button
                      variant={isCurrentVoiceRoom ? 'secondary' : 'outline'}
                      size="sm"
                      className="rounded-md"
                      onClick={() => {
                        if (voice.currentTarget?.roomHref && !isCurrentVoiceRoom) {
                          router.push(voice.currentTarget.roomHref);
                        }
                      }}
                    >
                      <Volume2 className="mr-1.5 h-4 w-4" />
                      {isCurrentVoiceRoom ? 'In call' : 'Open call'}
                    </Button>
                  ) : null}
                  {bootstrap.effectiveSettings.voiceEnabled ? (
                    <Button
                      variant={combinedActiveCall ? 'outline' : 'default'}
                      size="sm"
                      className="rounded-md"
                      onClick={handleOpenVoiceSetup}
                      disabled={
                        isJoiningCall ||
                        Boolean(voice.currentSession) ||
                        (!combinedActiveCall && !bootstrap.permissions.canStartCalls)
                      }
                    >
                      {isJoiningCall ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <PhoneCall className="mr-1.5 h-4 w-4" />
                      )}
                      {voice.currentSession ? 'In call' : combinedActiveCall ? 'Join call' : 'Start call'}
                    </Button>
                  ) : null}
                </div>
              </div>

              {callError ? (
                <div className="border-b px-4 py-2">
                  <div className="mx-auto w-full max-w-3xl rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {callError}
                  </div>
                </div>
              ) : null}

              {combinedActiveCall ? (
                <div className="border-b px-4 py-2">
                  <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-sm border px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">
                        {isCurrentVoiceRoom ? 'Voice call is live' : 'Active call in this room'}
                      </div>
                      <div className="truncate text-muted-foreground">
                        {isCurrentVoiceRoom
                          ? 'This room is active in the global sidebar dock'
                          : 'Someone in this room already started a call'}
                        {combinedActiveCall && 'participantCount' in combinedActiveCall
                          ? ` · ${Number(combinedActiveCall.participantCount) || 0} in call`
                          : ''}
                      </div>
                    </div>
                    {isCurrentVoiceRoom ? (
                      <Button size="sm" variant="outline" className="rounded-sm" onClick={() => void voice.leaveCurrentCall()}>
                        <PhoneOff className="mr-2 h-3.5 w-3.5" />
                        Leave
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-sm"
                        onClick={handleOpenVoiceSetup}
                        disabled={Boolean(voice.currentSession) || isJoiningCall}
                      >
                        <PhoneCall className="mr-2 h-3.5 w-3.5" />
                        Join
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex-1 overflow-y-auto">
                <div
                  className="mx-auto flex w-full max-w-4xl flex-col px-4 py-4 sm:px-6"
                >
                  {messagesQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading messages…
                    </div>
                  ) : messageList.length ? (
                    messageList.map((message) => (
                      <ChatMessageRow
                        key={message.id}
                        message={message}
                        onToggleReaction={handleToggleReaction}
                      />
                    ))
                  ) : (
                    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-sm border border-dashed px-6 text-center">
                      <div className="text-sm font-medium">No messages yet</div>
                      <div className="mt-1 text-sm text-muted-foreground">Post the first update or paste a screenshot.</div>
                    </div>
                  )}
                  <div ref={messageEndRef} />
                </div>
              </div>

              <div className="border-t px-4 py-3 sm:px-6">
                <form
                  className="mx-auto flex w-full max-w-4xl flex-col gap-3"
                  onSubmit={handleComposerSubmit}
                >
                  {queuedFiles.length ? (
                    <div className="flex flex-wrap gap-2">
                      {queuedFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex max-w-full items-center gap-2 rounded-md border px-2 py-1 text-xs"
                        >
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setQueuedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {composerError ? (
                    <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {composerError}
                    </div>
                  ) : null}

                  <Textarea
                    value={composerValue}
                    onChange={(event) => {
                      setComposerValue(event.target.value);
                      if (composerError) {
                        setComposerError(null);
                      }
                    }}
                    onKeyDown={handleComposerKeyDown}
                    onPaste={handlePaste}
                    placeholder="Write a message, use @name, or paste an image."
                    className="min-h-[84px] resize-y rounded-sm border bg-background"
                    disabled={!canSendMessages || isSendingMessage}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-sm border px-2 py-1 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!attachmentsEnabled || isSendingMessage}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        Attach
                      </button>
                      {sendDisabledReason ? <span>{sendDisabledReason}</span> : null}
                      {!sendDisabledReason ? (
                        <span className="hidden sm:inline">Paste screenshots directly. Ctrl/Cmd + Enter sends.</span>
                      ) : null}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => queueFiles(Array.from(event.target.files || []))}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={
                        isSendingMessage ||
                        Boolean(sendDisabledReason) ||
                        (!trimmedComposerValue && queuedFiles.length === 0)
                      }
                      size="sm"
                      className="rounded-md"
                    >
                      {isSendingMessage ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <SendHorizontal className="mr-2 h-4 w-4" />
                      )}
                      Send
                    </Button>
                  </div>
                </form>
              </div>
              </div>

              {bootstrap.effectiveSettings.voiceEnabled && isVoiceSetupOpen ? (
                <aside
                  className={cn(
                    'hidden h-full shrink-0 overflow-hidden transition-[width,border-color] duration-200 xl:flex',
                    isVoicePanelOpen ? 'w-[360px] border-l' : 'w-0 border-l-transparent'
                  )}
                >
                  <VoiceJoinSetupPanel
                    className={cn(
                      'h-full w-[360px] shrink-0',
                      !isVoicePanelOpen && 'pointer-events-none opacity-0'
                    )}
                    isJoining={isJoiningCall}
                    isPreparing={isPreparingVoiceSetup}
                    onClose={handleCloseVoicePanel}
                    onJoin={handleJoinCall}
                  />
                </aside>
              ) : null}
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <Card className="max-w-lg">
                <CardHeader>
                  <CardTitle>Select a conversation</CardTitle>
                  <CardDescription>
                    Choose a channel or open an issue/doc discussion to start collaborating.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function ChatSidebar({
  bootstrap,
  selectedRoomId,
  onSelectRoom,
  onCreateChannel,
}: {
  bootstrap: ChatBootstrapResponse;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onCreateChannel: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Project chat</div>
            <div className="truncate pt-1 text-sm font-semibold">{bootstrap.project.name}</div>
          </div>
          {bootstrap.permissions.canCreateChannels ? (
            <Button size="sm" variant="outline" className="rounded-md" onClick={onCreateChannel}>
              New
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 px-3 py-4">
          <section className="space-y-1">
            <div className="px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Channels</div>
            {bootstrap.channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => channel.roomId && onSelectRoom(channel.roomId)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm border border-transparent px-2.5 py-2 text-left text-sm transition-colors',
                  channel.roomId === selectedRoomId
                    ? 'border-border bg-muted/70 text-foreground'
                    : 'text-muted-foreground hover:border-border/60 hover:bg-muted/30 hover:text-foreground'
                )}
              >
                <Hash className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                {channel.activeCall ? (
                  <span className="rounded-sm border px-1.5 py-0.5 text-[11px] text-foreground">
                    call
                  </span>
                ) : null}
                {channel.unreadCount ? (
                  <span className="rounded-sm border px-1.5 py-0.5 text-[11px] text-foreground">{channel.unreadCount}</span>
                ) : null}
              </button>
            ))}
          </section>

          <section className="space-y-1">
            <div className="px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Recent</div>
            {bootstrap.recentDiscussions.length ? (
              bootstrap.recentDiscussions.map((discussion) => (
                <button
                  key={discussion.id}
                  type="button"
                  onClick={() => onSelectRoom(discussion.id)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-sm border border-transparent px-2.5 py-2 text-left transition-colors',
                    discussion.id === selectedRoomId
                      ? 'border-border bg-muted/70 text-foreground'
                      : 'text-muted-foreground hover:border-border/60 hover:bg-muted/30 hover:text-foreground'
                  )}
                >
                  <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {typeof discussion.context?.title === 'string'
                        ? discussion.context.title
                        : discussion.title || 'Discussion'}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {discussion.kind === 'issue_thread'
                        ? (discussion.context?.key as string | undefined) || 'Issue'
                        : 'Document'}
                    </div>
                  </div>
                  {discussion.activeCall ? (
                    <span className="rounded-sm border px-1.5 py-0.5 text-[11px] text-foreground">call</span>
                  ) : null}
                  {discussion.unreadCount ? (
                    <span className="rounded-sm border px-1.5 py-0.5 text-[11px] text-foreground">{discussion.unreadCount}</span>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="px-2 py-3 text-sm text-muted-foreground">Issue and doc threads appear here.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ChatMessageRow({
  message,
  onToggleReaction,
}: {
  message: ConversationMessage;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
}) {
  const authorName = message.author.name || message.author.email || 'Unknown user';

  return (
    <div className="flex gap-3 py-4">
      <Avatar className="mt-0.5 h-9 w-9">
        <AvatarImage src={message.author.image || undefined} alt={authorName} />
        <AvatarFallback className="text-xs">{getInitials(authorName)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{authorName}</span>
          <span className="text-xs text-muted-foreground">
            {message.optimistic
              ? 'Sending…'
              : formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
            {message.editedAt ? ' · edited' : ''}
          </span>
        </div>

        <div
          className={cn(
            'mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground',
            message.deletedAt && 'italic text-muted-foreground'
          )}
        >
          {message.deletedAt ? 'Message deleted' : message.body}
        </div>

        {message.attachments.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              attachment.filePath ? (
                <a
                  key={attachment.id}
                  href={`/api/uploads/${attachment.filePath.split('/').pop()}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-sm border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {attachment.fileName}
                </a>
              ) : (
                <div
                  key={attachment.id}
                  className="rounded-sm border px-2 py-1 text-xs text-muted-foreground"
                >
                  {attachment.fileName}
                </div>
              )
            ))}
          </div>
        ) : null}

        {!message.deletedAt && !message.optimistic ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.reactions.map((reaction) => (
              <button
                key={`${message.id}-${reaction.emoji}`}
                type="button"
                onClick={() => void onToggleReaction(message.id, reaction.emoji)}
                className={cn(
                  'rounded-sm border px-2 py-1 text-xs transition-colors',
                  reaction.reactedByCurrentUser
                    ? 'border-foreground/40 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={`${message.id}-${emoji}-quick`}
                type="button"
                onClick={() => void onToggleReaction(message.id, emoji)}
                className="rounded-sm border border-dashed px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChatVoiceDock({
  className,
  canManageCalls,
  isVisible,
  livekitSession,
  onClose,
  onEndCall,
  onDisconnected,
  onRuntimeError,
}: {
  className?: string;
  canManageCalls: boolean;
  isVisible: boolean;
  livekitSession: LivekitSession | null;
  onClose?: () => void;
  onEndCall: () => Promise<void>;
  onDisconnected: () => Promise<void>;
  onRuntimeError: (message: string) => void;
}) {
  const disconnectHandledRef = useRef(false);
  const disconnectModeRef = useRef<'leave' | 'end' | null>(null);
  const latestOnDisconnectedRef = useRef(onDisconnected);
  const latestOnEndCallRef = useRef(onEndCall);
  const latestOnRuntimeErrorRef = useRef(onRuntimeError);

  useEffect(() => {
    disconnectHandledRef.current = false;
    disconnectModeRef.current = null;
  }, [livekitSession?.roomName]);

  useEffect(() => {
    latestOnDisconnectedRef.current = onDisconnected;
    latestOnEndCallRef.current = onEndCall;
    latestOnRuntimeErrorRef.current = onRuntimeError;
  }, [onDisconnected, onEndCall, onRuntimeError]);

  const handleDisconnected = useCallback(async () => {
    if (disconnectHandledRef.current) {
      return;
    }

    disconnectHandledRef.current = true;
    await latestOnDisconnectedRef.current();

    if (disconnectModeRef.current === 'end') {
      await latestOnEndCallRef.current();
    }
  }, []);

  const handleRoomError = useCallback(
    (error: Error) => {
      const message = formatLivekitRuntimeError(error);
      if (!message) {
        return;
      }
      latestOnRuntimeErrorRef.current(message);
    },
    []
  );

  const handleMediaDeviceFailure = useCallback(
    (error?: Error) => {
      latestOnRuntimeErrorRef.current(formatMicrophoneError(error));
    },
    []
  );

  const handleRoomDisconnected = useCallback(() => {
    void handleDisconnected();
  }, [handleDisconnected]);

  if (!livekitSession) {
    return null;
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="text-sm font-semibold">Voice room</div>
          <div className="text-xs text-muted-foreground">Mic, levels, test, and people</div>
        </div>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ManagedLiveKitRoomProvider
          session={livekitSession}
          onDisconnected={handleRoomDisconnected}
          onError={handleRoomError}
          onMediaDeviceFailure={handleMediaDeviceFailure}
        >
          <InlineVoiceRoom
            canManageCalls={canManageCalls}
            isVisible={isVisible}
            onPrepareDisconnect={(mode) => {
              disconnectModeRef.current = mode;
            }}
          />
        </ManagedLiveKitRoomProvider>
      </div>
    </div>
  );
}

function VoiceJoinSetupPanel({
  className,
  isJoining,
  isPreparing,
  onClose,
  onJoin,
}: {
  className?: string;
  isJoining: boolean;
  isPreparing: boolean;
  onClose: () => void;
  onJoin: (options: {
    audioDeviceId: string;
    startWithMicrophone: boolean;
  }) => Promise<void>;
}) {
  const { storedAudioDeviceId, storeAudioDeviceId } = useStoredVoicePreferences();
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [isTestingMicrophone, setIsTestingMicrophone] = useState(false);
  const [isSelfMonitorEnabled, setIsSelfMonitorEnabled] = useState(false);
  const [microphoneTestLevel, setMicrophoneTestLevel] = useState(0);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const microphoneTestStreamRef = useRef<MediaStream | null>(null);
  const microphoneTestAudioContextRef = useRef<AudioContext | null>(null);
  const microphoneTestSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const microphoneTestAnalyserRef = useRef<AnalyserNode | null>(null);
  const microphoneTestIntervalRef = useRef<number | null>(null);
  const monitorAudioRef = useRef<HTMLAudioElement | null>(null);

  const refreshMicrophoneDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === 'audioinput');
      setMicrophoneDevices(audioInputs);
      if (
        storedAudioDeviceId !== 'default' &&
        !audioInputs.some((device) => device.deviceId === storedAudioDeviceId)
      ) {
        storeAudioDeviceId('default');
      }
    } catch (error) {
      setSetupError(formatMicrophoneError(error));
    }
  }, [storeAudioDeviceId, storedAudioDeviceId]);

  const resetMonitorAudio = useCallback(() => {
    if (!monitorAudioRef.current) {
      return;
    }

    try {
      monitorAudioRef.current.pause();
    } catch {
      // Ignore playback teardown issues in browsers/test environments.
    }
    monitorAudioRef.current.srcObject = null;
  }, []);

  const stopMicrophoneTest = useCallback(async () => {
    if (microphoneTestIntervalRef.current !== null) {
      window.clearInterval(microphoneTestIntervalRef.current);
      microphoneTestIntervalRef.current = null;
    }

    resetMonitorAudio();

    try {
      microphoneTestSourceRef.current?.disconnect();
    } catch {
      // Ignore teardown issues from partially initialized graphs.
    }
    microphoneTestSourceRef.current = null;

    try {
      microphoneTestAnalyserRef.current?.disconnect();
    } catch {
      // Ignore teardown issues from partially initialized graphs.
    }
    microphoneTestAnalyserRef.current = null;

    if (microphoneTestAudioContextRef.current) {
      try {
        await microphoneTestAudioContextRef.current.close();
      } catch {
        // Ignore teardown failures from browsers with partial AudioContext support.
      }
      microphoneTestAudioContextRef.current = null;
    }

    microphoneTestStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneTestStreamRef.current = null;

    setIsTestingMicrophone(false);
    setIsSelfMonitorEnabled(false);
    setMicrophoneTestLevel(0);
  }, [resetMonitorAudio]);

  useEffect(() => {
    void refreshMicrophoneDevices();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      void refreshMicrophoneDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshMicrophoneDevices]);

  useEffect(() => {
    return () => {
      void stopMicrophoneTest();
    };
  }, [stopMicrophoneTest]);

  useEffect(() => {
    const audioElement = monitorAudioRef.current;
    if (!audioElement) {
      return;
    }

    if (!isSelfMonitorEnabled || !isTestingMicrophone || !microphoneTestStreamRef.current) {
      resetMonitorAudio();
      return;
    }

    audioElement.srcObject = microphoneTestStreamRef.current;
    audioElement.volume = 0.9;
    const playPromise = audioElement.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        setSetupError('Self-monitor playback was blocked by the browser. Try the toggle again if needed.');
      });
    }

    return () => {
      resetMonitorAudio();
    };
  }, [isSelfMonitorEnabled, isTestingMicrophone, resetMonitorAudio]);

  const requestMicrophoneStream = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support microphone capture.');
    }

    return navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId:
          storedAudioDeviceId && storedAudioDeviceId !== 'default'
            ? { exact: storedAudioDeviceId }
            : undefined,
        ...DEFAULT_MIC_CAPTURE_OPTIONS,
      },
    });
  }, [storedAudioDeviceId]);

  async function handleSelectMicrophone(deviceId: string) {
    setSetupError(null);
    storeAudioDeviceId(deviceId);
    if (isTestingMicrophone) {
      await stopMicrophoneTest();
    }
  }

  async function handleToggleMicrophoneTest() {
    if (isTestingMicrophone) {
      await stopMicrophoneTest();
      return;
    }

    try {
      setSetupError(null);
      const stream = await requestMicrophoneStream();
      await refreshMicrophoneDevices();

      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) {
        throw new Error('AudioContext is unavailable in this browser.');
      }

      const audioContext = new AudioContextCtor();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      if (audioContext.state !== 'running') {
        throw new Error('AudioContext could not start with the current audio device.');
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.35;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);

      microphoneTestStreamRef.current = stream;
      microphoneTestAudioContextRef.current = audioContext;
      microphoneTestSourceRef.current = source;
      microphoneTestAnalyserRef.current = analyser;
      microphoneTestIntervalRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let index = 0; index < buffer.length; index += 1) {
          const centered = (buffer[index] - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / buffer.length);
        setMicrophoneTestLevel((current) => {
          const nextLevel = Math.min(1, rms * 2.8);
          return Math.abs(current - nextLevel) < 0.02 ? current : nextLevel;
        });
      }, 110);
      setIsTestingMicrophone(true);
    } catch (error) {
      await stopMicrophoneTest();
      setSetupError(formatMicrophoneError(error));
    }
  }

  async function handleJoin(startWithMicrophone: boolean) {
    if (isJoining || isSubmittingJoin) {
      return;
    }

    try {
      setIsSubmittingJoin(true);
      setSetupError(null);
      await stopMicrophoneTest();
      await onJoin({
        audioDeviceId: storedAudioDeviceId || 'default',
        startWithMicrophone,
      });
    } catch (error) {
      setSetupError(formatMicrophoneError(error));
    } finally {
      setIsSubmittingJoin(false);
    }
  }

  const selectedMicrophoneLabel =
    microphoneDevices.find((device) => device.deviceId === storedAudioDeviceId)?.label ||
    (storedAudioDeviceId === 'default' ? 'System default microphone' : 'Choose a microphone');

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="text-sm font-semibold">Join voice room</div>
          <div className="text-xs text-muted-foreground">
            Pick a mic once before connecting. This keeps self-hosted calls more stable.
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <audio ref={monitorAudioRef} hidden playsInline />

        <div className="space-y-4 rounded-sm border bg-muted/10 px-3 py-3">
          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Input device
            </div>
            <div className="truncate text-sm font-medium">{selectedMicrophoneLabel}</div>
          </div>

          <select
            className="flex h-9 w-full rounded-sm border bg-background px-3 text-sm outline-none"
            value={storedAudioDeviceId || 'default'}
            onChange={(event) => {
              void handleSelectMicrophone(event.target.value);
            }}
            disabled={isJoining || isSubmittingJoin}
          >
            <option value="default">System default microphone</option>
            {microphoneDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-sm"
              onClick={() => void handleToggleMicrophoneTest()}
              disabled={isJoining || isPreparing}
            >
              <TestTube2 className="mr-2 h-4 w-4" />
              {isTestingMicrophone ? 'Stop test' : 'Test mic'}
            </Button>
            <Button
              size="sm"
              variant={isSelfMonitorEnabled ? 'default' : 'outline'}
              className="rounded-sm"
              onClick={() => setIsSelfMonitorEnabled((current) => !current)}
              disabled={isPreparing || (!isTestingMicrophone && !isSelfMonitorEnabled)}
            >
              <Volume2 className="mr-2 h-4 w-4" />
              {isSelfMonitorEnabled ? 'Stop monitor' : 'Hear myself'}
            </Button>
          </div>

          <div className="space-y-2 rounded-sm border bg-background px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">
                {isTestingMicrophone
                  ? isSelfMonitorEnabled
                    ? 'Testing and monitoring'
                    : 'Testing locally'
                  : 'Mic level'}
              </div>
              <div className="text-xs font-medium tabular-nums text-muted-foreground">
                {Math.round(microphoneTestLevel * 100)}%
              </div>
            </div>
            <div className="h-3 overflow-hidden rounded-sm border bg-muted/20">
              <div
                className="h-full bg-foreground/80 transition-[width] duration-100"
                style={{ width: `${Math.round(microphoneTestLevel * 100)}%` }}
              />
            </div>
          </div>

          {setupError ? (
            <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {setupError}
            </div>
          ) : null}

          {isPreparing ? (
            <div className="rounded-sm border px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Preparing room token and call state…
              </div>
            </div>
          ) : null}

          <div className="rounded-sm border bg-background px-3 py-2 text-xs text-muted-foreground">
            The room connects first, then enables your chosen microphone. This keeps join noticeably faster while
            still respecting the device you picked above.
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="outline" className="rounded-sm" onClick={onClose} disabled={isJoining}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-sm"
              onClick={() => void handleJoin(false)}
              disabled={isJoining || isSubmittingJoin || isPreparing}
            >
              {isJoining || isSubmittingJoin || isPreparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Join muted
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-sm"
              onClick={() => void handleJoin(true)}
              disabled={isJoining || isSubmittingJoin || isPreparing}
            >
              {isJoining || isSubmittingJoin || isPreparing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mic className="mr-2 h-4 w-4" />
              )}
              Join with mic
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManagedLiveKitRoomProvider({
  children,
  onDisconnected,
  onError,
  onMediaDeviceFailure,
  session,
}: {
  children: ReactNode;
  onDisconnected: () => void;
  onError: (error: Error) => void;
  onMediaDeviceFailure: (error?: Error) => void;
  session: LivekitSession;
}) {
  const [room] = useState(() => createVoiceRoom());
  const latestOnDisconnectedRef = useRef(onDisconnected);
  const latestOnErrorRef = useRef(onError);
  const latestOnMediaDeviceFailureRef = useRef(onMediaDeviceFailure);
  const hasTriggeredDisconnectRef = useRef(false);

  useEffect(() => {
    latestOnDisconnectedRef.current = onDisconnected;
    latestOnErrorRef.current = onError;
    latestOnMediaDeviceFailureRef.current = onMediaDeviceFailure;
  }, [onDisconnected, onError, onMediaDeviceFailure]);

  useEffect(() => {
    hasTriggeredDisconnectRef.current = false;
  }, [session.roomName]);

  useEffect(() => {
    let disposed = false;

    const handleDisconnected = () => {
      if (disposed || hasTriggeredDisconnectRef.current) {
        return;
      }
      hasTriggeredDisconnectRef.current = true;
      latestOnDisconnectedRef.current();
    };

    const handleMediaDevicesError = (error: Error) => {
      if (disposed) {
        return;
      }
      latestOnMediaDeviceFailureRef.current(error);
    };

    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.MediaDevicesError, handleMediaDevicesError);

    void (async () => {
      try {
        await room.connect(session.url, session.token, {
          autoSubscribe: true,
          maxRetries: 0,
          peerConnectionTimeout: 30_000,
          websocketTimeout: 30_000,
        });

        if (disposed) {
          return;
        }

        if (session.audioDeviceId && session.audioDeviceId !== 'default') {
          await room.switchActiveDevice('audioinput', session.audioDeviceId, true);
        }

        if (session.startWithMicrophone) {
          await room.localParticipant.setMicrophoneEnabled(true, DEFAULT_MIC_CAPTURE_OPTIONS);
        }
      } catch (error) {
        if (disposed) {
          return;
        }
        latestOnErrorRef.current(
          error instanceof Error ? error : new Error('Failed to connect to voice room.')
        );
      }
    })();

    return () => {
      disposed = true;
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.MediaDevicesError, handleMediaDevicesError);
      void room.disconnect();
    };
  }, [room, session.roomName, session.token, session.url]);

  return <RoomContext.Provider value={room}>{children}</RoomContext.Provider>;
}

function InlineVoiceRoom({
  canManageCalls,
  isVisible,
  onPrepareDisconnect,
}: {
  canManageCalls: boolean;
  isVisible: boolean;
  onPrepareDisconnect: (mode: 'leave' | 'end') => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { canPlayAudio, startAudio } = useAudioPlayback(room);
  const participants = useParticipants({
    updateOnlyOn: [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ConnectionStateChanged,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
    ],
  });
  const { localParticipant, lastMicrophoneError } = useLocalParticipant();
  const { storedAudioDeviceId, storeAudioDeviceId } = useStoredVoicePreferences();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState<'audio' | 'people' | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isStartingAudioPlayback, setIsStartingAudioPlayback] = useState(false);
  const {
    enabled: isMicrophoneEnabled,
    pending: isMicrophonePending,
    toggle: toggleMicrophone,
  } = useTrackToggle({
    source: Track.Source.Microphone,
    captureOptions: DEFAULT_MIC_CAPTURE_OPTIONS,
    onDeviceError: (error) => {
      setVoiceError(formatMicrophoneError(error));
    },
    room,
  });
  const remoteParticipants = useMemo(
    () => participants.filter((participant) => participant.identity !== localParticipant.identity),
    [localParticipant.identity, participants]
  );
  const liveMicrophoneLevel = isVisible && isMicrophoneEnabled ? Math.min(1, localParticipant.audioLevel * 1.85) : 0;

  useEffect(() => {
    if (isVisible) {
      return;
    }

    setExpandedPanel(null);
  }, [isVisible]);

  async function handleEnableAudioPlayback() {
    try {
      setIsStartingAudioPlayback(true);
      setVoiceError(null);
      await startAudio();
    } catch (error) {
      setVoiceError(
        error instanceof Error
          ? `Speaker output could not start. ${error.message}`
          : 'Speaker output could not start on this device.'
      );
    } finally {
      setIsStartingAudioPlayback(false);
    }
  }

  async function handleToggleMicrophone() {
    if (connectionState !== 'connected') {
      setVoiceError('Wait for the call to finish connecting before changing your microphone state.');
      return;
    }

    try {
      setVoiceError(null);
      const targetEnabled = !isMicrophoneEnabled;

      if (targetEnabled && storedAudioDeviceId && storedAudioDeviceId !== 'default') {
        await room.switchActiveDevice('audioinput', storedAudioDeviceId, true);
      }

      await toggleMicrophone(targetEnabled);
    } catch (error) {
      setVoiceError(formatMicrophoneError(error));
    }
  }

  async function handleLeave() {
    try {
      setIsLeaving(true);
      setVoiceError(null);
      onPrepareDisconnect('leave');
      await room.disconnect();
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Failed to leave the call cleanly.');
    } finally {
      setIsLeaving(false);
    }
  }

  async function handleEnd() {
    try {
      setIsEnding(true);
      setVoiceError(null);
      onPrepareDisconnect('end');
      await room.disconnect();
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Failed to end the call cleanly.');
    } finally {
      setIsEnding(false);
    }
  }
  const isActivelySpeaking = isMicrophoneEnabled && liveMicrophoneLevel > 0.12;
  const deferredMicrophoneLevel = useDeferredValue(Math.min(1, liveMicrophoneLevel));
  const microphoneStatus = isMicrophoneEnabled
    ? isActivelySpeaking
      ? 'You are speaking'
      : 'Mic is live'
    : 'Mic muted';
  const hasRemoteAudio = remoteParticipants.some((participant) => participant.isMicrophoneEnabled);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-sm border bg-muted/10 px-3 py-3">
      {hasRemoteAudio ? <RoomAudioRenderer /> : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                isActivelySpeaking
                  ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.12)]'
                  : 'bg-amber-500/80'
              )}
            />
            <div className="text-sm font-medium">Voice room live</div>
            <Badge variant="outline" className="h-6 rounded-md px-2">
              <Users2 className="mr-1.5 h-3.5 w-3.5" />
              {participants.length}
            </Badge>
          </div>
          <div className="pt-1 text-xs text-muted-foreground">
            {formatConnectionStateLabel(connectionState)} · {microphoneStatus}
            {!canPlayAudio ? ' · enable audio once if playback is blocked' : ''}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!canPlayAudio && remoteParticipants.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-sm"
              onClick={() => void handleEnableAudioPlayback()}
              disabled={isStartingAudioPlayback}
            >
              {isStartingAudioPlayback ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Volume2 className="mr-2 h-4 w-4" />
              )}
              Enable audio
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={isMicrophoneEnabled ? 'default' : 'outline'}
            className="rounded-sm"
            onClick={() => void handleToggleMicrophone()}
            disabled={
              isMicrophonePending ||
              isLeaving ||
              isEnding ||
              connectionState !== 'connected'
            }
          >
            {isMicrophonePending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isMicrophoneEnabled ? (
              <Mic className="mr-2 h-4 w-4" />
            ) : (
              <MicOff className="mr-2 h-4 w-4" />
            )}
            {isMicrophonePending ? 'Updating' : isMicrophoneEnabled ? (isActivelySpeaking ? 'Speaking' : 'Mute') : 'Unmute'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-sm"
            onClick={() => void handleLeave()}
            disabled={isLeaving || isEnding}
          >
            {isLeaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneOff className="mr-2 h-4 w-4" />}
            Leave
          </Button>
          {canManageCalls ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-sm"
              onClick={() => void handleEnd()}
              disabled={isEnding || isLeaving}
            >
              {isEnding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              End room
            </Button>
          ) : null}
        </div>
      </div>

        <div className="mt-3 rounded-sm border bg-background px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Microphone
            </div>
            <div className="truncate pt-1 text-sm font-medium">{microphoneStatus}</div>
          </div>

          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Level</div>
            <div className="pt-1 text-sm font-medium tabular-nums">{Math.round(deferredMicrophoneLevel * 100)}%</div>
          </div>
        </div>

        <div className="mt-3 h-3 overflow-hidden rounded-sm border bg-muted/20">
          <div
            className={cn(
              'h-full transition-[width,background-color] duration-100',
              isActivelySpeaking ? 'bg-emerald-500' : 'bg-foreground/80'
            )}
            style={{ width: `${Math.round(deferredMicrophoneLevel * 100)}%` }}
          />
        </div>
      </div>

      {voiceError || lastMicrophoneError ? (
        <div className="mt-3 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          Audio error:{' '}
          {voiceError ||
            formatMicrophoneError(lastMicrophoneError) ||
            'Audio capture is unavailable. Check browser permissions and try again.'}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn('rounded-sm', expandedPanel === 'audio' && 'border-foreground/40 bg-muted/40')}
          onClick={() => setExpandedPanel((current) => (current === 'audio' ? null : 'audio'))}
        >
          Audio settings
          <ChevronDown
            className={cn('ml-2 h-4 w-4 transition-transform', expandedPanel === 'audio' && 'rotate-180')}
          />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn('rounded-sm', expandedPanel === 'people' && 'border-foreground/40 bg-muted/40')}
          onClick={() => setExpandedPanel((current) => (current === 'people' ? null : 'people'))}
        >
          People
          <span className="ml-2 rounded-sm border px-1.5 py-0.5 text-[11px]">{participants.length}</span>
        </Button>
      </div>

      {expandedPanel === 'audio' ? (
        <VoiceAudioSettingsPanel
          connectionState={connectionState}
          hasRemoteAudio={remoteParticipants.length > 0}
          isMicrophoneEnabled={isMicrophoneEnabled}
          isMicrophonePending={isMicrophonePending}
          onError={setVoiceError}
          storedAudioDeviceId={storedAudioDeviceId}
          storeAudioDeviceId={storeAudioDeviceId}
        />
      ) : null}

      {expandedPanel === 'people' ? (
        <div className="mt-3 grid gap-2">
          {participants.map((participant) => (
            <VoiceParticipantRow
              key={participant.identity}
              participant={participant}
              isCurrentUser={participant.identity === localParticipant.identity}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VoiceParticipantRow({
  participant,
  isCurrentUser,
}: {
  participant: Participant;
  isCurrentUser: boolean;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const displayName = participant.name || participant.identity || 'Participant';
  const micEnabled = participant.isMicrophoneEnabled;
  const stateLabel = micEnabled
    ? isCurrentUser
      ? isSpeaking
        ? 'Sending audio'
        : 'Mic on'
      : isSpeaking
        ? 'Speaking'
        : 'Listening'
    : 'Muted';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-sm border px-3 py-2',
        isSpeaking ? 'border-emerald-500/40 bg-emerald-500/5' : 'bg-muted/10'
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">{getInitials(displayName)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-medium">{displayName}</div>
          {isCurrentUser ? (
            <span className="rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              You
            </span>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">{stateLabel}</div>
      </div>

      <div className="flex items-center gap-2">
        {micEnabled ? (
          <Mic className={cn('h-3.5 w-3.5', isSpeaking ? 'text-emerald-500' : 'text-muted-foreground')} />
        ) : (
          <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            !micEnabled
              ? 'bg-muted-foreground/35'
              : isSpeaking
                ? 'bg-emerald-500'
                : 'bg-amber-500'
          )}
        />
      </div>
    </div>
  );
}

function VoiceAudioSettingsPanel({
  connectionState,
  hasRemoteAudio,
  isMicrophoneEnabled,
  isMicrophonePending,
  onError,
  storedAudioDeviceId,
  storeAudioDeviceId,
}: {
  connectionState: string;
  hasRemoteAudio: boolean;
  isMicrophoneEnabled: boolean;
  isMicrophonePending: boolean;
  onError: (message: string | null) => void;
  storedAudioDeviceId: string;
  storeAudioDeviceId: (deviceId: string) => void;
}) {
  const room = useRoomContext();
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);

  const refreshMicrophoneDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === 'audioinput');
      setMicrophoneDevices(audioInputs);
      if (storedAudioDeviceId !== 'default' && !audioInputs.some((device) => device.deviceId === storedAudioDeviceId)) {
        storeAudioDeviceId('default');
      }
    } catch (error) {
      onError(formatMicrophoneError(error));
    }
  }, [onError, storeAudioDeviceId, storedAudioDeviceId]);

  useEffect(() => {
    void refreshMicrophoneDevices();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      void refreshMicrophoneDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshMicrophoneDevices]);

  const selectedMicrophoneLabel =
    microphoneDevices.find((device) => device.deviceId === storedAudioDeviceId)?.label ||
    (storedAudioDeviceId === 'default' ? 'System default microphone' : 'Choose a microphone');

  async function handleSelectMicrophone(deviceId: string) {
    try {
      onError(null);
      await room.switchActiveDevice('audioinput', deviceId, deviceId !== 'default');
      storeAudioDeviceId(deviceId);
      await refreshMicrophoneDevices();
    } catch (error) {
      onError(formatMicrophoneError(error));
    }
  }

  return (
    <div className="mt-3 rounded-sm border bg-background px-3 py-3">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Input device
          </div>
          <div className="truncate text-sm font-medium">{selectedMicrophoneLabel}</div>
        </div>

        <div className="space-y-2">
          <select
            className="flex h-9 w-full rounded-sm border bg-background px-3 text-sm outline-none"
            value={storedAudioDeviceId || 'default'}
            onChange={(event) => {
              void handleSelectMicrophone(event.target.value);
            }}
            disabled={connectionState !== 'connected' || isMicrophonePending}
          >
            <option value="default">System default microphone</option>
            {microphoneDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-sm border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {hasRemoteAudio
            ? 'Speaker output activates when others are talking. Use the join setup panel if you want to test or self-monitor this device before reconnecting.'
            : 'No one else is in the room yet. Re-open join setup if you want to re-test this microphone locally.'}
          {isMicrophoneEnabled ? ' The live microphone is currently enabled.' : ' The live microphone is currently muted.'}
        </div>
      </div>
    </div>
  );
}

const MemoizedChatVoiceDock = memo(ChatVoiceDock);
MemoizedChatVoiceDock.displayName = 'MemoizedChatVoiceDock';

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TN';
}

function formatConnectionStateLabel(state: string) {
  switch (state) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'reconnecting':
      return 'Reconnecting';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Voice room';
  }
}

function formatMicrophoneError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('permission denied') || message.includes('notallowederror')) {
      return 'Microphone permission was denied. Allow microphone access in your browser and try again.';
    }
    if (message.includes('audiocontext encountered an error') || message.includes('webaudio renderer')) {
      return 'The browser audio engine failed for this device. Stop other audio apps or switch microphones, then try again.';
    }
    if (message.includes('notfounderror') || message.includes('requested device not found')) {
      return 'No microphone was found. Check your audio input device and try again.';
    }
    if (message.includes('notreadableerror') || message.includes('could not start audio source')) {
      return 'Your microphone is busy in another app. Close other audio apps and try again.';
    }
    return error.message;
  }

  return 'Microphone access is unavailable. Check browser permissions and try again.';
}

function formatLivekitRuntimeError(error: Error) {
  const message = error.message.toLowerCase();
  if (
    message.includes('client initiated disconnect') ||
    message.includes('closed peer connection') ||
    message.includes('abort connection attempt due to user initiated disconnect')
  ) {
    return '';
  }
  if (message.includes('permission denied') || message.includes('notallowederror')) {
    return 'Microphone permission was denied. Allow microphone access in your browser and try again.';
  }
  if (message.includes('could not start audio source') || message.includes('notreadableerror')) {
    return 'Your microphone could not be started. Another app may be using it.';
  }
  if (message.includes('audiocontext encountered an error') || message.includes('webaudio renderer')) {
    return 'The browser audio engine failed for this device. Stop other audio apps or change your microphone, then try again.';
  }
  if (message.includes('device not found') || message.includes('notfounderror')) {
    return 'No microphone was found for this browser session.';
  }
  return error.message;
}

function useStoredVoicePreferences() {
  const [storedAudioDeviceId, setStoredAudioDeviceId] = useState('default');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem('tasknebula-chat-voice-settings');
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as { audioDeviceId?: string };
      if (parsed.audioDeviceId) {
        setStoredAudioDeviceId(parsed.audioDeviceId);
      }
    } catch {
      // Ignore invalid saved voice preferences.
    }
  }, []);

  const writePreference = useCallback((next: { audioDeviceId?: string }) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem('tasknebula-chat-voice-settings');
      const current = raw ? (JSON.parse(raw) as { audioDeviceId?: string }) : {};
      window.localStorage.setItem(
        'tasknebula-chat-voice-settings',
        JSON.stringify({ ...current, ...next })
      );
    } catch {
      // Persistence issues should never break live calls.
    }
  }, []);

  const storeAudioDeviceId = useCallback(
    (audioDeviceId: string) => {
      setStoredAudioDeviceId(audioDeviceId);
      writePreference({ audioDeviceId });
    },
    [writePreference]
  );

  return {
    storedAudioDeviceId,
    storeAudioDeviceId,
  };
}
