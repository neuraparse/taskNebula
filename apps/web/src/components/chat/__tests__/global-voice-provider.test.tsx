import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GlobalVoiceProvider, useGlobalVoice } from '../global-voice-provider';

type MockRoomHandler = () => void;

const mockRoomConnect = jest.fn();
const mockRoomDisconnect = jest.fn();
const mockRoomOn = jest.fn();
const mockRoomOff = jest.fn();
const mockSetMicrophoneEnabled = jest.fn();
const mockCreateLocalAudioTrack = jest.fn();
const mockPublishTrack = jest.fn();
const mockSwitchActiveDevice = jest.fn();
const mockGetUserMedia = jest.fn();
let currentMicrophonePublication: {
  mute: jest.Mock;
  unmute: jest.Mock;
} | null = null;
let registeredHandlers: Record<string, MockRoomHandler | undefined> = {};
const defaultNavigatorUserAgent = global.navigator.userAgent;

jest.mock('@livekit/components-react', () => {
  const React = require('react');
  return {
    RoomContext: React.createContext(null),
    RoomAudioRenderer: () => null,
  };
});

jest.mock('livekit-client', () => ({
  Room: class MockRoom {
    state = 'connected';
    remoteParticipants = new Map();
    localParticipant = {
      isMicrophoneEnabled: false,
      audioLevel: 0,
      getTrackPublication: jest.fn(() => currentMicrophonePublication),
      publishTrack: mockPublishTrack,
      setMicrophoneEnabled: mockSetMicrophoneEnabled,
      switchActiveDevice: mockSwitchActiveDevice,
    };

    connect = mockRoomConnect;
    disconnect = mockRoomDisconnect;
    switchActiveDevice = mockSwitchActiveDevice;

    on = mockRoomOn.mockImplementation((event: string, handler: MockRoomHandler) => {
      registeredHandlers[event] = handler;
      return this;
    });

    off = mockRoomOff.mockImplementation((event: string) => {
      delete registeredHandlers[event];
      return this;
    });
  },
  RoomEvent: {
    Connected: 'Connected',
    ConnectionStateChanged: 'ConnectionStateChanged',
    Disconnected: 'Disconnected',
    LocalTrackPublished: 'LocalTrackPublished',
    LocalTrackUnpublished: 'LocalTrackUnpublished',
    MediaDevicesError: 'MediaDevicesError',
    ParticipantConnected: 'ParticipantConnected',
    ParticipantDisconnected: 'ParticipantDisconnected',
    TrackMuted: 'TrackMuted',
    TrackUnmuted: 'TrackUnmuted',
  },
  Track: {
    Source: {
      Microphone: 'microphone',
    },
  },
  createLocalAudioTrack: (...args: unknown[]) => mockCreateLocalAudioTrack(...args),
  LocalAudioTrack: class MockLocalAudioTrack {
    source?: string;
    mediaStream?: MediaStream;
    stop = jest.fn();

    constructor(public mediaStreamTrack: MediaStreamTrack) {
      this.mediaStreamTrack = mediaStreamTrack;
    }
  },
  MediaDeviceFailure: {
    getFailure: jest.fn(() => 'Other'),
  },
}));

function TestHarness({
  audioDeviceId = 'default',
  pendingMicrophoneStreamPromise = null,
  preflightMicrophoneStream = null,
  startWithMicrophone = false,
}: {
  audioDeviceId?: string;
  pendingMicrophoneStreamPromise?: Promise<MediaStream | null> | null;
  preflightMicrophoneStream?: MediaStream | null;
  startWithMicrophone?: boolean;
}) {
  const voice = useGlobalVoice();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    voice.startSession({
      session: {
        url: 'ws://localhost:7880',
        token: 'token',
        roomName: 'room-1',
        audioDeviceId,
        startWithMicrophone,
        participantIdentity: 'tnp:user-1:session-1',
        preflightMicrophoneStream,
        pendingMicrophoneStreamPromise,
      },
      target: {
        roomId: 'room-1',
        roomTitle: 'General',
        roomSubtitle: 'Project channel',
        roomHref: '/projects/web/chat?roomId=room-1',
        projectName: 'Website',
        projectPath: 'web',
        canManageCalls: true,
      },
    });
  }, [audioDeviceId, pendingMicrophoneStreamPromise, preflightMicrophoneStream, startWithMicrophone, voice]);

  return null;
}

function ConnectionStateProbe({
  onChange,
}: {
  onChange: (state: string) => void;
}) {
  const voice = useGlobalVoice();

  useEffect(() => {
    onChange(voice.connectionState);
  }, [onChange, voice.connectionState]);

  return null;
}

function RuntimeErrorProbe({
  onChange,
}: {
  onChange: (error: string | null) => void;
}) {
  const voice = useGlobalVoice();

  useEffect(() => {
    onChange(voice.runtimeError);
  }, [onChange, voice.runtimeError]);

  return null;
}

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

describe('GlobalVoiceProvider', () => {
  beforeEach(() => {
    Object.defineProperty(global.navigator, 'userAgent', {
      configurable: true,
      value: defaultNavigatorUserAgent,
    });
    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: mockGetUserMedia,
      },
    });
    Object.defineProperty(global.navigator, 'permissions', {
      configurable: true,
      value: {
        query: jest.fn().mockResolvedValue({ state: 'granted' }),
      },
    });
    registeredHandlers = {};
    currentMicrophonePublication = null;
    mockRoomConnect.mockReset().mockResolvedValue(undefined);
    mockRoomDisconnect.mockReset().mockResolvedValue(undefined);
    mockRoomOn.mockClear();
    mockRoomOff.mockClear();
    mockSetMicrophoneEnabled.mockReset().mockResolvedValue(undefined);
    mockCreateLocalAudioTrack.mockReset().mockResolvedValue({
      stop: jest.fn(),
    });
    mockGetUserMedia.mockReset().mockResolvedValue({
      getAudioTracks: () => [{ kind: 'audio', stop: jest.fn() }],
      getTracks: () => [{ kind: 'audio', stop: jest.fn() }],
    });
    mockPublishTrack.mockReset().mockResolvedValue({
      mute: jest.fn(),
      unmute: jest.fn(),
      isMuted: false,
    });
    mockSwitchActiveDevice.mockReset().mockResolvedValue(undefined);
  });

  it('keeps the active room connected across provider rerenders', async () => {
    renderWithQueryClient(
      <GlobalVoiceProvider>
        <TestHarness />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    const handleConnectionStateChanged = registeredHandlers.ConnectionStateChanged;
    expect(handleConnectionStateChanged).toBeDefined();

    handleConnectionStateChanged?.();

    await waitFor(() => {
      expect(mockRoomDisconnect).not.toHaveBeenCalled();
    });
  });

  it('does not disconnect the room when microphone startup falls back to default input', async () => {
    mockCreateLocalAudioTrack
      .mockRejectedValueOnce(new Error('Could not start audio source'))

    renderWithQueryClient(
      <GlobalVoiceProvider>
        <TestHarness audioDeviceId="mic-usb" startWithMicrophone />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockCreateLocalAudioTrack).toHaveBeenCalledTimes(1);
      expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    });

    expect(mockRoomDisconnect).not.toHaveBeenCalled();
  });

  it('keeps the room connected even if initial microphone enable hangs', async () => {
    const onConnectionStateChange = jest.fn();
    let releaseMicrophoneTrack: (() => void) | null = null;

    mockGetUserMedia.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseMicrophoneTrack = () =>
            resolve({
              getAudioTracks: () => [{ kind: 'audio', stop: jest.fn() }],
              stop: jest.fn(),
              getTracks: () => [{ kind: 'audio', stop: jest.fn() }],
            });
        })
    );

    renderWithQueryClient(
      <GlobalVoiceProvider>
        <ConnectionStateProbe onChange={onConnectionStateChange} />
        <TestHarness startWithMicrophone />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onConnectionStateChange).toHaveBeenCalledWith('connected');
    });

    expect(mockRoomDisconnect).not.toHaveBeenCalled();
    releaseMicrophoneTrack?.();
  });

  it('uses raw getUserMedia for the default microphone during initial enable', async () => {
    const mediaTrack = { kind: 'audio', stop: jest.fn() } as unknown as MediaStreamTrack;
    mockGetUserMedia.mockResolvedValueOnce({
      getAudioTracks: () => [mediaTrack],
      getTracks: () => [mediaTrack],
    });

    renderWithQueryClient(
      <GlobalVoiceProvider>
        <TestHarness startWithMicrophone />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateLocalAudioTrack).not.toHaveBeenCalled();
    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: true,
    });
    expect(mockPublishTrack).toHaveBeenCalledWith(mediaTrack, {
      source: 'microphone',
    });
  });

  it('uses a preflight microphone stream during the initial enable without re-requesting media', async () => {
    const mediaTrack = { kind: 'audio', stop: jest.fn() } as unknown as MediaStreamTrack;
    const preflightMicrophoneStream = {
      getAudioTracks: () => [mediaTrack],
      getTracks: () => [mediaTrack],
    } as unknown as MediaStream;

    renderWithQueryClient(
      <GlobalVoiceProvider>
        <TestHarness preflightMicrophoneStream={preflightMicrophoneStream} startWithMicrophone />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockPublishTrack).toHaveBeenCalledWith(mediaTrack, {
        source: 'microphone',
      });
    });

    expect(mockGetUserMedia).not.toHaveBeenCalled();
    expect(mockCreateLocalAudioTrack).not.toHaveBeenCalled();
  });

  it('automatically publishes a late microphone stream after the room has already connected', async () => {
    const mediaTrack = { kind: 'audio', stop: jest.fn() } as unknown as MediaStreamTrack;
    let resolvePendingMicrophoneStream: ((stream: MediaStream) => void) | null = null;
    const pendingMicrophoneStreamPromise = new Promise<MediaStream | null>((resolve) => {
      resolvePendingMicrophoneStream = resolve;
    });

    renderWithQueryClient(
      <GlobalVoiceProvider>
        <TestHarness pendingMicrophoneStreamPromise={pendingMicrophoneStreamPromise} />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    resolvePendingMicrophoneStream?.({
      getAudioTracks: () => [mediaTrack],
      getTracks: () => [mediaTrack],
    } as unknown as MediaStream);

    await waitFor(() => {
      expect(mockPublishTrack).toHaveBeenCalledWith(mediaTrack, {
        source: 'microphone',
      });
    });

    expect(mockGetUserMedia).not.toHaveBeenCalled();
    expect(mockCreateLocalAudioTrack).not.toHaveBeenCalled();
  });

  it('does not start a second microphone request while a pending browser prompt is still unresolved', async () => {
    const onRuntimeErrorChange = jest.fn();
    const pendingMicrophoneStreamPromise = new Promise<MediaStream | null>(() => undefined);

    function ToggleHarness() {
      const voice = useGlobalVoice();
      const toggledRef = useRef(false);

      useEffect(() => {
        if (voice.connectionState !== 'connected' || toggledRef.current) {
          return;
        }

        toggledRef.current = true;
        void voice.toggleMicrophone();
      }, [voice]);

      return null;
    }

    renderWithQueryClient(
      <GlobalVoiceProvider>
        <RuntimeErrorProbe onChange={onRuntimeErrorChange} />
        <TestHarness pendingMicrophoneStreamPromise={pendingMicrophoneStreamPromise} />
        <ToggleHarness />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onRuntimeErrorChange).toHaveBeenCalledWith(
        'Browser is still waiting for microphone access. Check the browser microphone prompt or this site\'s permissions and allow microphone access. TaskNebula will unmute automatically if access succeeds.'
      );
    });

    expect(mockGetUserMedia).not.toHaveBeenCalled();
    expect(mockCreateLocalAudioTrack).not.toHaveBeenCalled();
  });

  it('keeps an in-call chromium microphone prompt pending instead of failing fast', async () => {
    jest.useFakeTimers();

    const onRuntimeErrorChange = jest.fn();
    const mediaTrack = { kind: 'audio', stop: jest.fn() } as unknown as MediaStreamTrack;
    const originalUserAgent = global.navigator.userAgent;
    let resolveMicrophoneStream: ((stream: MediaStream) => void) | null = null;

    global.navigator.permissions.query.mockResolvedValue({ state: 'prompt' });
    Object.defineProperty(global.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    });
    mockGetUserMedia.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMicrophoneStream = resolve;
        })
    );

    function ToggleHarness() {
      const voice = useGlobalVoice();
      const toggledRef = useRef(false);

      useEffect(() => {
        if (voice.connectionState !== 'connected' || toggledRef.current) {
          return;
        }

        toggledRef.current = true;
        void voice.toggleMicrophone();
      }, [voice]);

      return null;
    }

    renderWithQueryClient(
      <GlobalVoiceProvider>
        <RuntimeErrorProbe onChange={onRuntimeErrorChange} />
        <TestHarness />
        <ToggleHarness />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: true,
      });
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(7_000);
      await Promise.resolve();
    });

    expect(onRuntimeErrorChange).toHaveBeenCalledWith(
      'Browser is still waiting for microphone access. Look for the microphone prompt in the address bar and choose Allow this time or Allow on every visit. If it was dismissed, open Chrome site settings for this site and allow the microphone. TaskNebula will unmute automatically if access succeeds.'
    );
    expect(mockPublishTrack).not.toHaveBeenCalled();

    resolveMicrophoneStream?.({
      getAudioTracks: () => [mediaTrack],
      getTracks: () => [mediaTrack],
    } as unknown as MediaStream);

    await waitFor(() => {
      expect(mockPublishTrack).toHaveBeenCalledWith(mediaTrack, {
        source: 'microphone',
      });
    });

    Object.defineProperty(global.navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    jest.useRealTimers();
  });

  it('surfaces a timeout message when a pending microphone request expires after joining', async () => {
    const onRuntimeErrorChange = jest.fn();
    let rejectPendingMicrophoneStream: ((error: Error) => void) | null = null;
    const pendingMicrophoneStreamPromise = new Promise<MediaStream | null>((_, reject) => {
      rejectPendingMicrophoneStream = reject;
    });

    renderWithQueryClient(
      <GlobalVoiceProvider>
        <RuntimeErrorProbe onChange={onRuntimeErrorChange} />
        <TestHarness pendingMicrophoneStreamPromise={pendingMicrophoneStreamPromise} />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    rejectPendingMicrophoneStream?.(
      new Error('Microphone request attempt "default-audio-true" timed out after 20000ms.')
    );

    await waitFor(() => {
      expect(onRuntimeErrorChange).toHaveBeenCalledWith(
        'Microphone access timed out while waiting for the browser prompt. Check the browser microphone prompt or this site\'s permissions and allow microphone access. If you approve it now, TaskNebula will still turn your mic on automatically. If no prompt appears, refresh this page or try the mic button again.'
      );
    });
  });

  it('keeps listening for a late browser prompt approval after the timeout banner appears', async () => {
    jest.useFakeTimers();

    const mediaTrack = { kind: 'audio', stop: jest.fn() } as unknown as MediaStreamTrack;
    const onRuntimeErrorChange = jest.fn();
    let resolvePendingMicrophoneStream: ((stream: MediaStream) => void) | null = null;
    const pendingMicrophoneStreamPromise = new Promise<MediaStream | null>((resolve) => {
      resolvePendingMicrophoneStream = resolve;
    });

    renderWithQueryClient(
      <GlobalVoiceProvider>
        <RuntimeErrorProbe onChange={onRuntimeErrorChange} />
        <TestHarness pendingMicrophoneStreamPromise={pendingMicrophoneStreamPromise} />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(onRuntimeErrorChange).toHaveBeenCalledWith(
        'Microphone access timed out while waiting for the browser prompt. Check the browser microphone prompt or this site\'s permissions and allow microphone access. If you approve it now, TaskNebula will still turn your mic on automatically. If no prompt appears, refresh this page or try the mic button again.'
      );
    });

    resolvePendingMicrophoneStream?.({
      getAudioTracks: () => [mediaTrack],
      getTracks: () => [mediaTrack],
    } as unknown as MediaStream);

    await waitFor(() => {
      expect(mockPublishTrack).toHaveBeenCalledWith(mediaTrack, {
        source: 'microphone',
      });
    });

    await waitFor(() => {
      expect(onRuntimeErrorChange).toHaveBeenLastCalledWith(null);
    });

    jest.useRealTimers();
  });

  it('automatically retries the microphone when browser permission flips to granted after a timeout', async () => {
    const mediaTrack = { kind: 'audio', stop: jest.fn() } as unknown as MediaStreamTrack;
    const onRuntimeErrorChange = jest.fn();
    let rejectPendingMicrophoneStream: ((error: Error) => void) | null = null;
    let permissionChangeHandler: (() => void) | null = null;
    const pendingMicrophoneStreamPromise = new Promise<MediaStream | null>((_, reject) => {
      rejectPendingMicrophoneStream = reject;
    });

    const permissionStatus = {
      state: 'prompt',
      addEventListener: jest.fn((event: string, handler: () => void) => {
        if (event === 'change') {
          permissionChangeHandler = handler;
        }
      }),
      removeEventListener: jest.fn(),
      onchange: null,
    };

    global.navigator.permissions.query.mockResolvedValue(permissionStatus);
    mockGetUserMedia.mockResolvedValue({
      getAudioTracks: () => [mediaTrack],
      getTracks: () => [mediaTrack],
    });

    renderWithQueryClient(
      <GlobalVoiceProvider>
        <RuntimeErrorProbe onChange={onRuntimeErrorChange} />
        <TestHarness pendingMicrophoneStreamPromise={pendingMicrophoneStreamPromise} />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    rejectPendingMicrophoneStream?.(
      new Error('Microphone request attempt "default-audio-true" timed out after 20000ms.')
    );

    await waitFor(() => {
      expect(onRuntimeErrorChange).toHaveBeenCalledWith(
        'Microphone access timed out while waiting for the browser prompt. Check the browser microphone prompt or this site\'s permissions and allow microphone access. If you approve it now, TaskNebula will still turn your mic on automatically. If no prompt appears, refresh this page or try the mic button again.'
      );
    });

    await waitFor(() => {
      expect(permissionStatus.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    permissionStatus.state = 'granted';
    permissionChangeHandler?.();

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: true,
      });
    });

    await waitFor(() => {
      expect(mockPublishTrack).toHaveBeenCalledWith(mediaTrack, {
        source: 'microphone',
      });
    });
  });

  it('unmutes an existing microphone publication without creating a new track', async () => {
    const unmute = jest.fn().mockResolvedValue(undefined);
    currentMicrophonePublication = {
      mute: jest.fn().mockResolvedValue(undefined),
      unmute,
    };

    function ToggleHarness() {
      const voice = useGlobalVoice();
      const startedRef = useRef(false);
      const toggledRef = useRef(false);

      useEffect(() => {
        if (startedRef.current) {
          return;
        }
        startedRef.current = true;
        voice.startSession({
          session: {
            url: 'ws://localhost:7880',
            token: 'token',
            roomName: 'room-1',
            audioDeviceId: 'default',
            startWithMicrophone: false,
            participantIdentity: 'tnp:user-1:session-1',
          },
          target: {
            roomId: 'room-1',
            roomTitle: 'General',
            roomSubtitle: 'Project channel',
            roomHref: '/projects/web/chat?roomId=room-1',
            projectName: 'Website',
            projectPath: 'web',
            canManageCalls: true,
          },
        });
      }, [voice]);

      useEffect(() => {
        if (voice.connectionState !== 'connected' || toggledRef.current) {
          return;
        }
        toggledRef.current = true;
        void voice.toggleMicrophone();
      }, [voice]);

      return null;
    }

    renderWithQueryClient(
      <GlobalVoiceProvider>
        <ToggleHarness />
      </GlobalVoiceProvider>
    );

    await waitFor(() => {
      expect(mockRoomConnect).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(unmute).toHaveBeenCalled();
    });

    expect(mockCreateLocalAudioTrack).not.toHaveBeenCalled();
  });
});
