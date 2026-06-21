/**
 * /projects/[projectId]/chat/page.tsx is a thin wrapper around <ChatShell>.
 * Extensive voice/call behavior is covered by components/chat/__tests__.
 * This suite keeps it minimal: the wrapper resolves `projectId` from async
 * params, forwards it to the shell so the project-chat bootstrap fires, and
 * the shell surfaces a selectable channel list + a live message area from
 * /api/conversations/[roomId]/messages (no hardcoded rooms or mock bodies).
 */
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';

// RTL / LiveKit mount-time effects produce a benign React 19 act() warning
// under test — same situation as the chat-shell suite. Filter it locally.
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === 'string' &&
      first.includes('The current testing environment is not configured to support act')
    ) {
      return;
    }
    originalConsoleError.apply(console, args as Parameters<typeof console.error>);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});

const bootstrapSpy = jest.fn();
const conversationMessagesSpy = jest.fn();
const replaceSpy = jest.fn();
const redirectSpy = jest.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});
const notFoundSpy = jest.fn(() => {
  throw new Error('not-found');
});
const mockAuth = jest.fn();
const mockGetProjectChatContext = jest.fn();

class MockChatAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

jest.mock('@/auth', () => ({
  auth: mockAuth,
}));

jest.mock('@/lib/chat/server', () => ({
  ChatAccessError: MockChatAccessError,
  getProjectChatContext: mockGetProjectChatContext,
}));

jest.mock('@/components/projects/project-access-denied', () => ({
  ProjectAccessDenied: () => <div data-testid="project-access-denied" />,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceSpy, push: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/projects/project-1/chat',
  useSearchParams: () => new URLSearchParams('roomId=room-1'),
  redirect: redirectSpy,
  notFound: notFoundSpy,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

// Minimal LiveKit mocks — the chat page pulls in <ChatShell>, which imports
// livekit modules at module scope. We don't exercise voice here.
jest.mock('@livekit/components-react', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- required inside jest.mock factory
  const React = require('react');
  const RoomContext = React.createContext({
    connect: jest.fn(),
    disconnect: jest.fn(),
    prepareConnection: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    switchActiveDevice: jest.fn(),
    localParticipant: { setMicrophoneEnabled: jest.fn() },
  });
  return {
    RoomContext,
    setLogLevel: jest.fn(),
    RoomAudioRenderer: () => null,
    useAudioPlayback: () => ({ canPlayAudio: true, startAudio: jest.fn() }),
    useConnectionState: () => 'disconnected',
    useRoomContext: () => React.useContext(RoomContext),
    useParticipants: () => [],
    useLocalParticipant: () => ({
      localParticipant: { identity: 'user-1' },
      lastMicrophoneError: null,
    }),
    useIsSpeaking: () => false,
    useTrackToggle: () => ({ enabled: false, pending: false, toggle: jest.fn() }),
  };
});

jest.mock('livekit-client', () => ({
  LogLevel: { silent: 5 },
  Room: class {
    connect = jest.fn();
    disconnect = jest.fn();
    prepareConnection = jest.fn();
    on = jest.fn();
    off = jest.fn();
    switchActiveDevice = jest.fn();
    localParticipant = { setMicrophoneEnabled: jest.fn() };
  },
  RoomEvent: { Disconnected: 'Disconnected', MediaDevicesError: 'MediaDevicesError' },
  Track: { Source: { Microphone: 'microphone' } },
  setLogLevel: jest.fn(),
}));

jest.mock('@/lib/hooks/use-chat', () => ({
  useProjectChatBootstrap: (projectId: string | undefined) => {
    bootstrapSpy(projectId);
    return {
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
          canCreateChannels: false,
          canPostMessages: true,
          canModerateMessages: false,
          canStartCalls: false,
          canManageCalls: false,
        },
        channels: [
          {
            id: 'channel-general',
            name: 'general',
            slug: 'general',
            description: 'Team updates',
            roomId: 'room-1',
            unreadCount: 0,
            participantCount: 1,
            lastMessage: null,
            activeCall: null,
          },
          {
            id: 'channel-design',
            name: 'design',
            slug: 'design',
            description: 'Design chatter',
            roomId: 'room-2',
            unreadCount: 3,
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
    };
  },
  useConversationMessages: (roomId: string | undefined) => {
    conversationMessagesSpy(roomId);
    return {
      data: [
        {
          id: 'msg-1',
          roomId: 'room-1',
          body: 'Release plan shipped to staging.',
          attachments: [],
          mentions: [],
          deletedAt: null,
          editedAt: null,
          createdAt: new Date('2026-04-20T09:00:00Z').toISOString(),
          author: {
            id: 'user-1',
            name: 'Admin User',
            email: 'admin@example.com',
            image: null,
          },
          canDelete: true,
          canEdit: true,
          moderation: null,
          reactions: [],
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
      hasMore: false,
      isLoadingMore: false,
      loadMore: jest.fn(),
    };
  },
  useCreateConversationMessage: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateConversationMessage: () => ({ mutateAsync: jest.fn() }),
  useDeleteConversationMessage: () => ({ mutateAsync: jest.fn() }),
  useModerateConversationMessages: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useMarkConversationRead: () => ({ mutate: jest.fn() }),
  useStartConversationCall: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useEndConversationCall: () => ({ mutateAsync: jest.fn() }),
  useLeaveConversationCall: () => ({ mutateAsync: jest.fn() }),
  useCallToken: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useConversationStream: () => ({ isConnected: true, presence: [], activeCall: null }),
  useLiveCalls: () => ({ data: [], isLoading: false }),
}));

jest.mock('@/components/chat/global-voice-provider', () => ({
  useGlobalVoice: () => ({
    currentSession: null,
    currentTarget: null,
    runtimeError: null,
    connectionState: 'disconnected',
    participantCount: 0,
    isMicrophoneEnabled: false,
    isTogglingMicrophone: false,
    microphoneLevel: 0,
    setRuntimeError: jest.fn(),
    startSession: jest.fn(),
    toggleMicrophone: jest.fn(),
    leaveCurrentCall: jest.fn(),
    endCurrentCall: jest.fn(),
    clearCurrentCall: jest.fn(),
  }),
}));

async function renderProjectChatPage(projectId: string) {
  const { default: ProjectChatPage } = await import('../[projectId]/chat/page');
  const element = await ProjectChatPage({
    params: Promise.resolve({ projectId }),
  });
  return render(element as ReactNode);
}

describe('Project chat page', () => {
  beforeEach(() => {
    bootstrapSpy.mockReset();
    conversationMessagesSpy.mockReset();
    replaceSpy.mockReset();
    redirectSpy.mockClear();
    notFoundSpy.mockClear();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockGetProjectChatContext.mockResolvedValue({ canView: true });
  });

  it('forwards projectId into the bootstrap query and renders the selected channel header', async () => {
    await renderProjectChatPage('project-1');

    // Bootstrap must fire with the route's projectId — no hardcoded key.
    expect(bootstrapSpy).toHaveBeenCalledWith('project-1');

    // The selected channel's name + description from bootstrap render in the
    // conversation header (proving the shell resolves rooms from the
    // bootstrap response, not a baked-in demo list). The full sidebar
    // channel list is rendered through a layout portal (PageSidebarContent)
    // that is only mounted when the route layout is present; we don't
    // reproduce that here.
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('Team updates')).toBeInTheDocument();
  });

  it('loads messages for the selected room and renders them in the message area', async () => {
    await renderProjectChatPage('project-1');

    // useConversationMessages was called with the room id from the URL
    // (?roomId=room-1) — proving the page/shell is wired to
    // /api/conversations/[roomId]/messages, not a mock array.
    expect(conversationMessagesSpy).toHaveBeenCalledWith('room-1');

    // The message body from the query surfaces in the message area.
    expect(screen.getByText('Release plan shipped to staging.')).toBeInTheDocument();
  });
});
