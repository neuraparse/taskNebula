/**
 * Regression test for the chat-shell URL-sync infinite loop bug.
 *
 * Bug summary:
 *   The `useEffect` that hydrates `?roomId=` from `bootstrap.lastActiveRoomId`
 *   used to depend on `router` and `searchParams` (both new references per
 *   render from `next/navigation`). Calling `router.replace(...)` inside the
 *   effect mutated the URL, `searchParams` identity changed, the effect re-ran,
 *   called `router.replace` again, and the page appeared to continuously
 *   refresh.
 *
 * Fix under test:
 *   - The effect reads `router/searchParams/pathname` from refs instead of
 *     taking them as dependencies, AND
 *   - A `syncedBootstrapRoomRef` guards against re-syncing the same
 *     `lastActiveRoomId` twice.
 *
 * These tests assert that `router.replace` is invoked at most once for the
 * hydration regardless of how many times `searchParams`/`router` change
 * identity across re-renders.
 */

import type { ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { ChatShell } from '../chat-shell';

// ---------------------------------------------------------------------------
// next/navigation mock — exposes a mutable searchParams so we can simulate
// Next re-issuing a new URLSearchParams reference per render.
// ---------------------------------------------------------------------------

const replaceSpy = jest.fn();
const pushSpy = jest.fn();

let currentSearchParamsString = '';
const getSearchParams = () => new URLSearchParams(currentSearchParamsString);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceSpy, push: pushSpy }),
  usePathname: () => '/projects/project-1/chat',
  // Return a fresh URLSearchParams each call to mirror Next.js behaviour where
  // the hook hands back a new reference on every render.
  useSearchParams: () => getSearchParams(),
}));

// ---------------------------------------------------------------------------
// Minimal shell of use-toast — the component calls this on mount.
// ---------------------------------------------------------------------------

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

// ---------------------------------------------------------------------------
// LiveKit mocks — ChatShell imports from these at module scope so they must
// be mocked even though the URL-sync behaviour never touches LiveKit.
// ---------------------------------------------------------------------------

jest.mock('@livekit/components-react', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- required inside jest.mock factory
  const React = require('react');
  const RoomContext = React.createContext({});
  return {
    RoomContext,
    setLogLevel: jest.fn(),
    RoomAudioRenderer: () => null,
    useAudioPlayback: () => ({ canPlayAudio: true, startAudio: jest.fn() }),
    useConnectionState: () => 'disconnected',
    useRoomContext: () => ({}),
    useParticipants: () => [],
    useLocalParticipant: () => ({ localParticipant: null, lastMicrophoneError: null }),
    useIsSpeaking: () => false,
    useTrackToggle: () => ({ enabled: false, pending: false, toggle: jest.fn() }),
  };
});

jest.mock('livekit-client', () => ({
  LogLevel: { silent: 5 },
  Room: class MockRoom {
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

// ---------------------------------------------------------------------------
// Chat data hooks — bootstrap exposes `lastActiveRoomId: 'room-1'` so the
// URL-sync effect has work to do on mount.
// ---------------------------------------------------------------------------

const refetchMock = jest.fn();

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
        unreadTrackingEnabled: false,
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
          unreadCount: 0,
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
    refetch: refetchMock,
  }),
  useConversationMessages: () => ({
    data: [],
    isLoading: false,
    refetch: jest.fn(),
    hasMore: false,
    isLoadingMore: false,
    loadMore: jest.fn(),
  }),
  useCreateConversationMessage: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateConversationMessage: () => ({ mutateAsync: jest.fn() }),
  useDeleteConversationMessage: () => ({ mutateAsync: jest.fn() }),
  useModerateConversationMessages: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useMarkConversationRead: () => ({ mutate: jest.fn() }),
  useStartConversationCall: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useEndConversationCall: () => ({ mutateAsync: jest.fn() }),
  useLeaveConversationCall: () => ({ mutateAsync: jest.fn() }),
  useCallToken: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useConversationStream: () => ({ isConnected: false, presence: [], activeCall: null }),
  useLiveCalls: () => ({ data: [], isLoading: false }),
}));

// ---------------------------------------------------------------------------
// Voice provider stub — must return a stable-enough object; the effect under
// test doesn't inspect any of these fields.
// ---------------------------------------------------------------------------

jest.mock('@/components/chat/global-voice-provider', () => ({
  GlobalVoiceProvider: ({ children }: { children: ReactNode }) => children,
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

// ---------------------------------------------------------------------------
// Swallow the benign "not configured to support act" message that RTL's
// async helpers produce for unrelated microphone-probe effects in ChatShell.
// Mirrors the same filter used by chat-shell.test.tsx.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatShell URL-sync effect', () => {
  beforeEach(() => {
    replaceSpy.mockReset();
    pushSpy.mockReset();
    refetchMock.mockReset();
    // Start with an empty search — no `roomId` — so bootstrap hydration runs.
    currentSearchParamsString = '';
  });

  it('hydrates ?roomId= from bootstrap exactly once on initial mount', () => {
    const { unmount } = render(<ChatShell projectId="project-1" />);

    // Exactly one replace invocation, targeting room-1 with scroll:false.
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    const [url, options] = replaceSpy.mock.calls[0] as [string, { scroll?: boolean } | undefined];
    expect(url).toContain('roomId=room-1');
    expect(url.startsWith('/projects/project-1/chat?')).toBe(true);
    expect(options).toEqual({ scroll: false });

    unmount();
  });

  it('does not re-fire the sync effect on subsequent re-renders with fresh next/navigation references', () => {
    const { rerender } = render(<ChatShell projectId="project-1" />);
    expect(replaceSpy).toHaveBeenCalledTimes(1);

    // Force multiple re-renders. Each call to `useRouter` / `useSearchParams`
    // produces a fresh reference (see the mock above). If the effect still
    // depended on those identities, we'd see additional `replaceSpy` calls.
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        rerender(<ChatShell projectId="project-1" />);
      });
    }

    expect(replaceSpy).toHaveBeenCalledTimes(1);
  });

  it('does not re-sync when searchParams updates to reflect the freshly-set roomId', () => {
    const { rerender } = render(<ChatShell projectId="project-1" />);
    expect(replaceSpy).toHaveBeenCalledTimes(1);

    // Simulate Next.js commit of the router.replace by updating the mocked
    // searchParams so subsequent render cycles see `roomId=room-1`.
    act(() => {
      currentSearchParamsString = 'roomId=room-1';
      rerender(<ChatShell projectId="project-1" />);
    });

    // Extra re-renders to catch any delayed re-fire.
    for (let i = 0; i < 3; i += 1) {
      act(() => {
        rerender(<ChatShell projectId="project-1" />);
      });
    }

    expect(replaceSpy).toHaveBeenCalledTimes(1);
  });

  it('does not hydrate when searchParams already carries a roomId on mount', () => {
    currentSearchParamsString = 'roomId=room-1';

    render(<ChatShell projectId="project-1" />);

    // Nothing to sync — selectedRoomId is already populated from the URL.
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
