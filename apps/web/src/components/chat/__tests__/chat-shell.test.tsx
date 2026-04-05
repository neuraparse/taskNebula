import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatShell, VoiceJoinSetupPanel } from '../chat-shell';

const toast = jest.fn();
const replace = jest.fn();
const startCallMutateAsync = jest.fn();
const callTokenMutateAsync = jest.fn();
const leaveCallMutateAsync = jest.fn();
const createMessageMutateAsync = jest.fn();
const deleteMessageMutateAsync = jest.fn();
const moderateMessagesMutateAsync = jest.fn();
const messagesRefetch = jest.fn();
const loadMoreMessages = jest.fn();
const markReadMutate = jest.fn();
const startSessionMock = jest.fn();
var roomConnect: jest.Mock;
var roomDisconnect: jest.Mock;
var roomPrepareConnection: jest.Mock;
var roomOn: jest.Mock;
var roomOff: jest.Mock;
var roomSetMicrophoneEnabled: jest.Mock;
var roomSwitchActiveDevice: jest.Mock;
var roomConstructorArgs: Record<string, unknown> | undefined;
let currentConnectionState = 'connected';
let currentMicrophoneEnabled = true;
let currentMicrophoneError: Error | null = null;
let currentTrackVolume = 0.42;
let liveCallsData: Array<Record<string, unknown>> = [];
let startSessionError: Error | null = null;
let conversationMessagesData: Array<Record<string, unknown>> = [];
let conversationHasMore = false;
let setVoiceRuntimeErrorRef: ((message: string | null) => void) | null = null;
const originalUserAgent = window.navigator.userAgent;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/projects/project-1/chat',
  useSearchParams: () => new URLSearchParams('roomId=room-1'),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}));

jest.mock('@livekit/components-react', () => {
  const React = require('react');
  roomConnect ||= jest.fn();
  roomDisconnect ||= jest.fn();
  roomPrepareConnection ||= jest.fn();
  roomOn ||= jest.fn();
  roomOff ||= jest.fn();
  roomSetMicrophoneEnabled ||= jest.fn();
  roomSwitchActiveDevice ||= jest.fn();
  const RoomContext = React.createContext({
    connect: roomConnect,
    disconnect: roomDisconnect,
    prepareConnection: roomPrepareConnection,
    on: roomOn,
    off: roomOff,
    switchActiveDevice: roomSwitchActiveDevice,
    localParticipant: {
      setMicrophoneEnabled: roomSetMicrophoneEnabled,
    },
  });

  return {
    RoomContext,
    setLogLevel: jest.fn(),
    RoomAudioRenderer: () => null,
    useSequentialRoomConnectDisconnect: (room: { connect: typeof roomConnect; disconnect: typeof roomDisconnect }) => ({
      connect: room.connect,
      disconnect: room.disconnect,
    }),
    useAudioPlayback: () => ({
      canPlayAudio: true,
      startAudio: jest.fn(),
    }),
    useConnectionState: () => currentConnectionState,
    useRoomContext: () => React.useContext(RoomContext),
    useParticipants: () => [
      { identity: 'user-1', name: 'Admin User', isMicrophoneEnabled: currentMicrophoneEnabled },
      { identity: 'user-2', name: 'Dev User', isMicrophoneEnabled: false },
    ],
    useLocalParticipant: () => ({
      localParticipant: {
        identity: 'user-1',
        audioLevel: currentTrackVolume,
      },
      lastMicrophoneError: currentMicrophoneError,
    }),
    useIsSpeaking: (participant?: { identity?: string }) => participant?.identity === 'user-1',
    useTrackToggle: () => ({
      enabled: currentMicrophoneEnabled,
      pending: false,
      toggle: roomSetMicrophoneEnabled,
    }),
  };
});

jest.mock('livekit-client', () => ({
  LogLevel: { silent: 5 },
  Room: class MockRoom {
    constructor(options?: Record<string, unknown>) {
      roomConstructorArgs = options;
      roomConnect ||= jest.fn();
      roomDisconnect ||= jest.fn();
      roomPrepareConnection ||= jest.fn();
      roomOn ||= jest.fn();
      roomOff ||= jest.fn();
      roomSetMicrophoneEnabled ||= jest.fn();
      roomSwitchActiveDevice ||= jest.fn();
    }
    connect = roomConnect;
    disconnect = roomDisconnect;
    prepareConnection = roomPrepareConnection;
    on = roomOn;
    off = roomOff;
    switchActiveDevice = roomSwitchActiveDevice;
    localParticipant = {
      setMicrophoneEnabled: roomSetMicrophoneEnabled,
    };
  },
  RoomEvent: {
    Disconnected: 'Disconnected',
    MediaDevicesError: 'MediaDevicesError',
  },
  Track: { Source: { Microphone: 'microphone' } },
  setLogLevel: jest.fn(),
}));

jest.mock('@/lib/hooks/use-chat', () => ({
  useProjectChatBootstrap: () => ({
    data: {
      project: { id: 'project-1', key: 'WEB', name: 'Website Redesign' },
      effectiveSettings: {
        enabled: true,
        voiceEnabled: true,
        issueThreadsEnabled: true,
        documentThreadsEnabled: true,
        attachmentsEnabled: true,
        unreadTrackingEnabled: true,
      },
      permissions: {
        canBrowseProject: true,
        canAdministerProject: true,
        canBrowseChat: true,
        canCreateChannels: true,
        canPostMessages: true,
        canModerateMessages: true,
        canStartCalls: true,
        canManageCalls: true,
      },
      channels: [
        {
          id: 'channel-1',
          name: 'general',
          slug: 'general',
          description: 'Team updates',
          roomId: 'room-1',
          unreadCount: 2,
          participantCount: 1,
          lastMessage: null,
          activeCall: null,
        },
      ],
      recentDiscussions: [],
      activeCalls: [],
      lastActiveRoomId: 'room-1',
    },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useConversationMessages: () => ({
    data: conversationMessagesData,
    isLoading: false,
    refetch: messagesRefetch,
    hasMore: conversationHasMore,
    isLoadingMore: false,
    loadMore: loadMoreMessages,
  }),
  useCreateConversationMessage: () => ({
    mutateAsync: createMessageMutateAsync.mockResolvedValue(undefined),
    isPending: false,
  }),
  useUpdateConversationMessage: () => ({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
  }),
  useDeleteConversationMessage: () => ({
    mutateAsync: deleteMessageMutateAsync.mockResolvedValue(undefined),
  }),
  useModerateConversationMessages: () => ({
    mutateAsync: moderateMessagesMutateAsync.mockResolvedValue({
      action: 'clear_deleted',
      affectedCount: 1,
    }),
    isPending: false,
  }),
  useMarkConversationRead: () => ({
    mutate: markReadMutate,
  }),
  useStartConversationCall: () => ({
    mutateAsync: startCallMutateAsync.mockResolvedValue({}),
    isPending: false,
  }),
  useEndConversationCall: () => ({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
  }),
  useLeaveConversationCall: () => ({
    mutateAsync: leaveCallMutateAsync.mockResolvedValue(undefined),
  }),
  useCallToken: () => ({
    mutateAsync: callTokenMutateAsync.mockResolvedValue({
      url: 'ws://localhost:7880',
      token: 'token',
      roomName: 'room-name',
      participantIdentity: 'tnp:user-1:session-1',
    }),
    isPending: false,
  }),
  useConversationStream: () => ({
    isConnected: true,
    presence: [{ roomId: 'room-1', userId: 'user-1', name: 'Admin User', image: null, lastSeenAt: new Date().toISOString() }],
    activeCall: null,
  }),
  useLiveCalls: () => ({
    data: liveCallsData,
    isLoading: false,
  }),
}));

jest.mock('@/components/chat/global-voice-provider', () => {
  const React = require('react');

  return {
    useGlobalVoice: () => {
      const [currentSession, setCurrentSession] = React.useState(null);
      const [currentTarget, setCurrentTarget] = React.useState(null);
      const [runtimeError, setRuntimeError] = React.useState(null);
      const [connectionState, setConnectionState] = React.useState('disconnected');
      const [participantCount, setParticipantCount] = React.useState(0);
      const [isMicrophoneEnabled, setIsMicrophoneEnabled] = React.useState(false);
      const [isTogglingMicrophone, setIsTogglingMicrophone] = React.useState(false);

      setVoiceRuntimeErrorRef = setRuntimeError;

      const clear = () => {
        setCurrentSession(null);
        setCurrentTarget(null);
        setConnectionState('disconnected');
        setParticipantCount(0);
        setIsMicrophoneEnabled(false);
      };

      return {
        currentSession,
        currentTarget,
        runtimeError,
        connectionState,
        participantCount,
        isMicrophoneEnabled,
        isTogglingMicrophone,
        microphoneLevel: isMicrophoneEnabled ? 0.36 : 0,
        setRuntimeError,
        startSession: ({ session, target }: { session: Record<string, unknown>; target: Record<string, unknown> }) => {
          startSessionMock({ session, target });
          if (startSessionError) {
            throw startSessionError;
          }
          setRuntimeError(null);
          setCurrentSession(session);
          setCurrentTarget(target);
          setConnectionState('connected');
          setParticipantCount(1);
          setIsMicrophoneEnabled(Boolean(session.startWithMicrophone));
        },
        toggleMicrophone: async () => {
          setIsTogglingMicrophone(true);
          try {
            await roomSetMicrophoneEnabled(
              !isMicrophoneEnabled,
              !isMicrophoneEnabled
                ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                  }
                : undefined
            );
            setIsMicrophoneEnabled((current: boolean) => !current);
          } catch (error) {
            setRuntimeError(error instanceof Error ? error.message : 'Failed to update microphone');
            throw error;
          } finally {
            setIsTogglingMicrophone(false);
          }
        },
        leaveCurrentCall: async () => {
          await leaveCallMutateAsync();
          clear();
        },
        endCurrentCall: async () => {
          clear();
        },
        clearCurrentCall: clear,
      };
    },
  };
});

describe('ChatShell', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    messagesRefetch.mockResolvedValue(undefined);
    createMessageMutateAsync.mockResolvedValue(undefined);
    moderateMessagesMutateAsync.mockResolvedValue({ action: 'clear_deleted', affectedCount: 1 });
    markReadMutate.mockReset();
    roomConnect.mockResolvedValue(undefined);
    roomDisconnect.mockResolvedValue(undefined);
    roomPrepareConnection.mockResolvedValue(undefined);
    roomOn.mockReturnValue(undefined);
    roomOff.mockReturnValue(undefined);
    startSessionMock.mockReset();
    roomSetMicrophoneEnabled.mockImplementation(async (enabled?: boolean) => {
      if (typeof enabled === 'boolean') {
        currentMicrophoneEnabled = enabled;
      }
      return undefined;
    });
    roomSwitchActiveDevice.mockResolvedValue(undefined);
    roomConstructorArgs = undefined;
    currentConnectionState = 'connected';
    currentMicrophoneEnabled = false;
    currentMicrophoneError = null;
    currentTrackVolume = 0.04;
    liveCallsData = [];
    startSessionError = null;
    conversationHasMore = false;
    setVoiceRuntimeErrorRef = null;
    conversationMessagesData = [
      {
        id: 'message-1',
        roomId: 'room-1',
        body: 'Latest release plan is ready.',
        attachments: [],
        mentions: [],
        deletedAt: null,
        editedAt: null,
        createdAt: new Date('2026-04-04T08:00:00Z').toISOString(),
        author: {
          id: 'user-1',
          name: 'Admin User',
          email: 'admin@tasknebula.io',
          image: null,
        },
        canDelete: true,
        canEdit: true,
        moderation: null,
        reactions: [],
      },
    ];
    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: jest.fn().mockResolvedValue([
          { deviceId: 'mic-default', label: 'Built-in Microphone', kind: 'audioinput' },
          { deviceId: 'mic-usb', label: 'USB Podcast Mic', kind: 'audioinput' },
        ]),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        getUserMedia: jest.fn().mockResolvedValue({
          getTracks: () => [{ stop: jest.fn() }],
        }),
      },
    });
    Object.defineProperty(global.navigator, 'permissions', {
      configurable: true,
      value: {
        query: jest.fn().mockResolvedValue({ state: 'granted' }),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the simplified chat layout without the old detail sidebar', () => {
    render(<ChatShell projectId="project-1" />);

    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getAllByText('general').length).toBeGreaterThan(0);
    expect(screen.getByText('Latest release plan is ready.')).toBeInTheDocument();
    expect(screen.queryByText('Room details')).not.toBeInTheDocument();
    expect(screen.queryByText('Files')).not.toBeInTheDocument();
  });

  it('opens the voice setup panel first and then joins the inline voice dock', async () => {
    const user = userEvent.setup();
    render(<ChatShell projectId="project-1" />);

    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /start call/i })[0]);
    });

    expect(await screen.findByText('Join voice room')).toBeInTheDocument();
    const joinWithMicButton = await screen.findByRole('button', { name: /join with mic/i });
    await waitFor(() => {
      expect(joinWithMicButton).toBeEnabled();
    });

    await act(async () => {
      await user.click(joinWithMicButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Voice call is live')).toBeInTheDocument();
    });
    expect(callTokenMutateAsync).toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /in call/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Join voice room')).not.toBeInTheDocument();
  });

  it('does not start or prepare a call just by opening the voice setup panel', async () => {
    const user = userEvent.setup();
    render(<ChatShell projectId="project-1" />);

    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /start call/i })[0]);
    });

    expect(await screen.findByText('Join voice room')).toBeInTheDocument();
    expect(startCallMutateAsync).not.toHaveBeenCalled();
    expect(callTokenMutateAsync).not.toHaveBeenCalled();
    expect(startSessionMock).not.toHaveBeenCalled();
  });

  it('uses the selected microphone device when joining the call', async () => {
    const user = userEvent.setup();
    render(<ChatShell projectId="project-1" />);

    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /start call/i })[0]);
    });
    const microphoneSelect = await screen.findByRole('combobox');
    fireEvent.change(microphoneSelect, { target: { value: 'mic-usb' } });
    const joinWithMicButton = screen.getByRole('button', { name: /join with mic/i });
    await waitFor(() => {
      expect(joinWithMicButton).toBeEnabled();
    });
    await user.click(joinWithMicButton);

    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          session: expect.objectContaining({
            audioDeviceId: 'mic-usb',
            preflightMicrophoneStream: expect.any(Object),
            startWithMicrophone: true,
          }),
        })
      );
    });
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: 'mic-usb' },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  it('keeps the selected microphone for Chromium live joins after access is already granted', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    });

    render(<ChatShell projectId="project-1" />);

    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /start call/i })[0]);
    });

    const microphoneSelect = await screen.findByRole('combobox');
    fireEvent.change(microphoneSelect, { target: { value: 'mic-usb' } });
    const joinWithMicButton = screen.getByRole('button', { name: /join with mic/i });
    await waitFor(() => {
      expect(joinWithMicButton).toBeEnabled();
    });
    await user.click(joinWithMicButton);

    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          session: expect.objectContaining({
            audioDeviceId: 'mic-usb',
            preflightMicrophoneStream: expect.any(Object),
            startWithMicrophone: true,
          }),
        })
      );
    });
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: 'mic-usb' },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  it('does not probe the microphone when joining without mic', async () => {
    const user = userEvent.setup();

    render(<ChatShell projectId="project-1" />);

    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /start call/i })[0]);
    });

    const joinMutedButton = screen.getByRole('button', { name: /^join muted$/i });
    await waitFor(() => {
      expect(joinMutedButton).toBeEnabled();
    });
    await user.click(joinMutedButton);

    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          session: expect.objectContaining({
            startWithMicrophone: false,
          }),
        })
      );
    });
    expect(global.navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('joins muted quickly while microphone access is still waiting on a browser prompt', async () => {
    jest.useFakeTimers();
    const onJoin = jest.fn().mockResolvedValue(undefined);
    global.navigator.permissions.query.mockResolvedValue({ state: 'prompt' });
    global.navigator.mediaDevices.getUserMedia.mockImplementation(
      () => new Promise(() => undefined)
    );

    render(
      <VoiceJoinSetupPanel
        isJoining={false}
        isPreparing={false}
        isReady
        onClose={jest.fn()}
        onJoin={onJoin}
      />
    );

    const microphoneSelect = await screen.findByRole('combobox');
    await waitFor(() => {
      expect(microphoneSelect).toHaveValue('default');
    });
    const joinWithMicButton = await screen.findByRole('button', { name: /join with mic/i });
    expect(joinWithMicButton).toBeEnabled();

    await act(async () => {
      fireEvent.click(joinWithMicButton);
      await jest.advanceTimersByTimeAsync(1_500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onJoin).toHaveBeenCalledWith(
      expect.objectContaining({
        audioDeviceId: 'default',
        startWithMicrophone: false,
        pendingMicrophoneStreamPromise: expect.any(Promise),
      })
    );

    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
    });
  });

  it('preserves the selected microphone for later unmute when join falls back muted', async () => {
    jest.useFakeTimers();
    const onJoin = jest.fn().mockResolvedValue(undefined);
    global.navigator.permissions.query.mockResolvedValue({ state: 'prompt' });
    global.navigator.mediaDevices.getUserMedia.mockImplementation(
      () => new Promise(() => undefined)
    );
    window.localStorage.setItem(
      'tasknebula-chat-voice-settings',
      JSON.stringify({
        audioDeviceId: 'mic-usb',
        audioDeviceLabel: 'USB Podcast Mic',
      })
    );

    render(
      <VoiceJoinSetupPanel
        isJoining={false}
        isPreparing={false}
        isReady
        onClose={jest.fn()}
        onJoin={onJoin}
      />
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const microphoneSelect = screen.getByRole('combobox');
    expect(microphoneSelect).toHaveValue('mic-usb');
    const joinWithMicButton = screen.getByRole('button', { name: /join with mic/i });
    expect(joinWithMicButton).toBeEnabled();

    fireEvent.click(joinWithMicButton);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_600);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onJoin).toHaveBeenCalledWith(
      expect.objectContaining({
        audioDeviceId: 'mic-usb',
        startWithMicrophone: false,
        pendingMicrophoneStreamPromise: expect.any(Promise),
      })
    );
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
    });
  });

  it('replaces the pending microphone banner with the latest voice runtime error', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    global.navigator.permissions.query.mockResolvedValue({ state: 'prompt' });
    global.navigator.mediaDevices.getUserMedia.mockImplementation(
      () => new Promise(() => undefined)
    );

    render(<ChatShell projectId="project-1" />);

    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /start call/i })[0]);
    });

    const joinWithMicButton = await screen.findByRole('button', { name: /join with mic/i });

    await act(async () => {
      await user.click(joinWithMicButton);
      await jest.advanceTimersByTimeAsync(1_500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      await screen.findByText(/joined muted while the browser finishes microphone access/i)
    ).toBeInTheDocument();

    await act(async () => {
      setVoiceRuntimeErrorRef?.(
        'Microphone access timed out while waiting for the browser prompt. Check the browser microphone prompt or this site\'s permissions and allow microphone access. Then try the mic button again.'
      );
      await Promise.resolve();
    });

    expect(
      await screen.findByText(/microphone access timed out while waiting for the browser prompt/i)
    ).toBeInTheDocument();
  });

  it('runs a local mic test from the join setup panel before connecting', async () => {
    const user = userEvent.setup();

    render(<ChatShell projectId="project-1" />);

    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /start call/i })[0]);
    });

    await user.click(await screen.findByRole('button', { name: /test mic/i }));

    await waitFor(() => {
      expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });
    expect(screen.getByRole('button', { name: /hear myself/i })).toBeInTheDocument();
  });

  it('shows an active-call banner for users who open a room while another teammate is already in a call', () => {
    liveCallsData = [
      {
        id: 'call-1',
        roomId: 'room-1',
        livekitRoomName: 'live-room',
        participantCount: 2,
        startedAt: new Date('2026-04-04T09:00:00Z').toISOString(),
        joinedParticipantId: null,
        isParticipant: false,
        project: {
          id: 'project-1',
          key: 'WEB',
          name: 'Website Redesign',
          path: 'web',
        },
        room: {
          id: 'room-1',
          kind: 'channel',
          title: 'general',
          subtitle: 'Team updates',
          href: '/projects/project-1/chat?roomId=room-1',
        },
      },
    ];

    render(<ChatShell projectId="project-1" />);

    expect(screen.getByText('Active call in this room')).toBeInTheDocument();
    expect(screen.getAllByText(/2 in call/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /join/i }).length).toBeGreaterThan(0);
  });

  it('submits a message from the composer through the mutation hook', async () => {
    const user = userEvent.setup();
    render(<ChatShell projectId="project-1" />);

    await user.type(screen.getByPlaceholderText(/write a message/i), 'Need final QA sign-off');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => {
      expect(createMessageMutateAsync).toHaveBeenCalledWith({
        body: 'Need final QA sign-off',
        files: [],
      });
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/write a message/i)).toHaveValue('');
    });
  });

  it('shows a load older button and requests older pages on demand', async () => {
    const user = userEvent.setup();
    conversationHasMore = true;

    render(<ChatShell projectId="project-1" />);

    await user.click(screen.getByRole('button', { name: /load older messages/i }));

    expect(loadMoreMessages).toHaveBeenCalledTimes(1);
  });

  it('keeps a deleted message in the timeline and lets moderators remove it', async () => {
    const user = userEvent.setup();
    render(<ChatShell projectId="project-1" />);

    await user.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(deleteMessageMutateAsync).toHaveBeenCalledWith('message-1');
    });
  });

  it('shows moderator context for deleted messages', () => {
    conversationMessagesData = [
      {
        id: 'message-1',
        roomId: 'room-1',
        body: '',
        attachments: [],
        mentions: [],
        deletedAt: new Date('2026-04-04T09:00:00Z').toISOString(),
        editedAt: null,
        createdAt: new Date('2026-04-04T08:00:00Z').toISOString(),
        author: {
          id: 'user-2',
          name: 'Dev User',
          email: 'dev1@tasknebula.io',
          image: null,
        },
        canDelete: false,
        canEdit: false,
        moderation: {
          deletedBody: 'Original confidential note',
          deletedById: 'user-1',
          deletedByName: 'Admin User',
          deletedAt: new Date('2026-04-04T09:00:00Z').toISOString(),
          deletedAttachments: [],
        },
        reactions: [],
      },
    ];

    render(<ChatShell projectId="project-1" />);

    expect(screen.getByText('Message deleted')).toBeInTheDocument();
    expect(screen.getByText('Deleted by Admin User')).toBeInTheDocument();
    expect(screen.getByText('Original confidential note')).toBeInTheDocument();
  });

  it('opens moderation tools and clears deleted messages', async () => {
    const user = userEvent.setup();
    render(<ChatShell projectId="project-1" />);

    await user.click(screen.getByRole('button', { name: /moderation tools/i }));
    await user.click(screen.getByRole('menuitem', { name: /clear deleted messages/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(moderateMessagesMutateAsync).toHaveBeenCalledWith('clear_deleted');
    });
  });

  it('marks the latest message as read only once for the same room state', () => {
    const { rerender } = render(<ChatShell projectId="project-1" />);

    expect(markReadMutate).toHaveBeenCalledTimes(1);
    expect(markReadMutate).toHaveBeenCalledWith(
      'message-1',
      expect.objectContaining({
        onError: expect.any(Function),
      })
    );

    rerender(<ChatShell projectId="project-1" />);

    expect(markReadMutate).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate rapid message submits while a send is already in flight', async () => {
    const user = userEvent.setup();
    createMessageMutateAsync.mockImplementation(() => new Promise(() => undefined));

    render(<ChatShell projectId="project-1" />);

    await user.type(screen.getByPlaceholderText(/write a message/i), 'Race condition check');
    await user.click(screen.getByRole('button', { name: /^send$/i }));
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(createMessageMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate join attempts while a call join is already in progress', async () => {
    const user = userEvent.setup();

    render(<ChatShell projectId="project-1" />);

    await user.click(screen.getAllByRole('button', { name: /start call/i })[0]);
    const joinButton = await screen.findByRole('button', { name: /join with mic/i });
    await waitFor(() => {
      expect(joinButton).toBeEnabled();
    });
    await user.click(joinButton);
    await user.click(joinButton);

    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledTimes(1);
    });
  });

  it('recovers when the first call token request returns the start-call conflict', async () => {
    const user = userEvent.setup();
    callTokenMutateAsync
      .mockRejectedValueOnce(new Error('Start a call before joining.'))
      .mockResolvedValueOnce({
        url: 'ws://localhost:7880',
        token: 'retry-token',
        roomName: 'retry-room',
      });

    render(<ChatShell projectId="project-1" />);

    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /start call/i })[0]);
    });
    const joinWithMicButton = await screen.findByRole('button', { name: /join with mic/i });
    await waitFor(() => {
      expect(joinWithMicButton).toBeEnabled();
    });
    await user.click(joinWithMicButton);

    await waitFor(() => {
      expect(screen.getByText('Voice call is live')).toBeInTheDocument();
    });

    expect(startCallMutateAsync).toHaveBeenCalledTimes(1);
    expect(callTokenMutateAsync).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/failed to join call/i)).not.toBeInTheDocument();
  });

  it('shows a clear audio error if microphone access fails while joining', async () => {
    const user = userEvent.setup();
    startSessionError = new Error('Permission denied');

    render(<ChatShell projectId="project-1" />);

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /start call/i })[0]);
    });
    const joinWithMicButton = await screen.findByRole('button', { name: /join with mic/i });
    await waitFor(() => {
      expect(joinWithMicButton).toBeEnabled();
    });
    fireEvent.click(joinWithMicButton);

    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
    });
  });
});
