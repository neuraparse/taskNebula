'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  RoomContext,
  RoomAudioRenderer,
} from '@livekit/components-react';
import {
  Room,
  RoomEvent,
} from 'livekit-client';

const DEFAULT_MIC_CAPTURE_OPTIONS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;
const CALL_HEARTBEAT_INTERVAL_MS = 15_000;

function createVoiceRoom() {
  return new Room({
    adaptiveStream: false,
    dynacast: false,
    disconnectOnPageLeave: false,
    singlePeerConnection: false,
  });
}

function sendLeaveBeacon(roomId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const endpoint = `/api/conversations/${roomId}/call/leave`;
  const payload = '{}';

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    } catch {
      // Fall back to fetch below.
    }
  }

  void fetch(endpoint, {
    method: 'POST',
    body: payload,
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
  }).catch(() => {});
}

export type PersistentVoiceSession = {
  url: string;
  token: string;
  roomName: string;
  audioDeviceId: string;
  startWithMicrophone: boolean;
};

export type PersistentVoiceTarget = {
  roomId: string;
  roomTitle: string;
  roomSubtitle: string;
  roomHref: string;
  projectName: string;
  projectPath: string;
  canManageCalls: boolean;
};

type GlobalVoiceContextValue = {
  currentSession: PersistentVoiceSession | null;
  currentTarget: PersistentVoiceTarget | null;
  runtimeError: string | null;
  connectionState: string;
  participantCount: number;
  isMicrophoneEnabled: boolean;
  isTogglingMicrophone: boolean;
  microphoneLevel: number;
  setRuntimeError: (message: string | null) => void;
  startSession: (input: {
    session: PersistentVoiceSession;
    target: PersistentVoiceTarget;
  }) => void;
  toggleMicrophone: () => Promise<void>;
  leaveCurrentCall: () => Promise<void>;
  endCurrentCall: () => Promise<void>;
  clearCurrentCall: () => void;
};

const GlobalVoiceContext = createContext<GlobalVoiceContextValue>({
  currentSession: null,
  currentTarget: null,
  runtimeError: null,
  connectionState: 'disconnected',
  participantCount: 0,
  isMicrophoneEnabled: false,
  isTogglingMicrophone: false,
  microphoneLevel: 0,
  setRuntimeError: () => {},
  startSession: () => {},
  toggleMicrophone: async () => {},
  leaveCurrentCall: async () => {},
  endCurrentCall: async () => {},
  clearCurrentCall: () => {},
});

function getRoomParticipantCount(room: Room, connectionState: string) {
  if (connectionState === 'disconnected') {
    return 0;
  }

  return room.remoteParticipants.size + 1;
}

export function GlobalVoiceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [currentSession, setCurrentSession] = useState<PersistentVoiceSession | null>(null);
  const [currentTarget, setCurrentTarget] = useState<PersistentVoiceTarget | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [participantCount, setParticipantCount] = useState(0);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [isTogglingMicrophone, setIsTogglingMicrophone] = useState(false);
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const roomRef = useRef<Room | null>(null);
  const levelIntervalRef = useRef<number | null>(null);

  const leaveCurrentCallBestEffort = useCallback((roomId: string | null | undefined) => {
    if (!roomId) {
      return;
    }

    sendLeaveBeacon(roomId);
  }, []);

  const stopLevelSampling = useCallback(() => {
    if (levelIntervalRef.current !== null) {
      window.clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    setMicrophoneLevel(0);
  }, []);

  const syncRoomState = useCallback(
    (room: Room | null) => {
      if (!room) {
        setConnectionState('disconnected');
        setParticipantCount(0);
        setIsMicrophoneEnabled(false);
        stopLevelSampling();
        return;
      }

      const nextConnectionState = String((room as Room & { state?: string }).state || 'connected');
      const nextMicrophoneEnabled = Boolean(
        (room.localParticipant as typeof room.localParticipant & { isMicrophoneEnabled?: boolean }).isMicrophoneEnabled
      );

      setConnectionState(nextConnectionState);
      setParticipantCount(getRoomParticipantCount(room, nextConnectionState));
      setIsMicrophoneEnabled(nextMicrophoneEnabled);

      if (nextConnectionState === 'connected' && nextMicrophoneEnabled) {
        if (levelIntervalRef.current === null) {
          levelIntervalRef.current = window.setInterval(() => {
            const nextRoom = roomRef.current;
            if (!nextRoom) {
              stopLevelSampling();
              return;
            }

            const localParticipant = nextRoom.localParticipant as typeof nextRoom.localParticipant & {
              audioLevel?: number;
              isMicrophoneEnabled?: boolean;
            };
            const rawLevel =
              localParticipant.isMicrophoneEnabled && typeof localParticipant.audioLevel === 'number'
                ? localParticipant.audioLevel
                : 0;
            const nextLevel = Math.min(1, rawLevel * 1.9);
            setMicrophoneLevel((current) => (Math.abs(current - nextLevel) < 0.02 ? current : nextLevel));
          }, 120);
        }
      } else {
        stopLevelSampling();
      }
    },
    [stopLevelSampling]
  );

  const clearCurrentCall = useCallback(() => {
    roomRef.current = null;
    stopLevelSampling();
    setConnectionState('disconnected');
    setParticipantCount(0);
    setIsMicrophoneEnabled(false);
    setIsTogglingMicrophone(false);
    setCurrentSession(null);
    setCurrentTarget(null);
    setRuntimeError(null);
    queryClient.invalidateQueries({ queryKey: ['live-calls'] });
    queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
  }, [queryClient, stopLevelSampling]);

  const startSession = useCallback(
    (input: { session: PersistentVoiceSession; target: PersistentVoiceTarget }) => {
      setRuntimeError(null);
      setConnectionState('connecting');
      setParticipantCount(0);
      setIsMicrophoneEnabled(Boolean(input.session.startWithMicrophone));
      setCurrentSession(input.session);
      setCurrentTarget(input.target);
      queryClient.invalidateQueries({ queryKey: ['live-calls'] });
      queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
    },
    [queryClient]
  );

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room || connectionState !== 'connected') {
      throw new Error('Wait for the call to connect before changing your microphone.');
    }

    try {
      setIsTogglingMicrophone(true);
      setRuntimeError(null);
      const targetEnabled = !isMicrophoneEnabled;

      if (targetEnabled) {
        await room.localParticipant.setMicrophoneEnabled(true, DEFAULT_MIC_CAPTURE_OPTIONS);
      } else {
        await room.localParticipant.setMicrophoneEnabled(false);
      }

      syncRoomState(room);
    } catch (error) {
      const message = formatMicrophoneError(error);
      setRuntimeError(message);
      throw error;
      } finally {
      setIsTogglingMicrophone(false);
    }
  }, [connectionState, isMicrophoneEnabled, syncRoomState]);

  const handleRoomAttached = useCallback(
    (room: Room) => {
      roomRef.current = room;
      syncRoomState(room);
    },
    [syncRoomState]
  );

  const handleRoomDetached = useCallback(
    (room: Room) => {
      if (roomRef.current === room) {
        roomRef.current = null;
      }
      syncRoomState(null);
    },
    [syncRoomState]
  );

  const leaveCurrentCall = useCallback(async () => {
    if (!currentTarget?.roomId) {
      clearCurrentCall();
      return;
    }

    try {
      await fetch(`/api/conversations/${currentTarget.roomId}/call/leave`, { method: 'POST' });
    } finally {
      clearCurrentCall();
    }
  }, [clearCurrentCall, currentTarget?.roomId]);

  const endCurrentCall = useCallback(async () => {
    if (!currentTarget?.roomId) {
      clearCurrentCall();
      return;
    }

    try {
      await fetch(`/api/conversations/${currentTarget.roomId}/call/end`, { method: 'POST' });
    } finally {
      clearCurrentCall();
    }
  }, [clearCurrentCall, currentTarget?.roomId]);

  const handleUnexpectedDisconnect = useCallback(() => {
    leaveCurrentCallBestEffort(currentTarget?.roomId);
    clearCurrentCall();
  }, [clearCurrentCall, currentTarget?.roomId, leaveCurrentCallBestEffort]);

  useEffect(() => {
    if (!currentSession || !currentTarget?.roomId) {
      return;
    }

    const roomId = currentTarget.roomId;
    const handlePageHide = () => {
      leaveCurrentCallBestEffort(roomId);
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [currentSession, currentTarget?.roomId, leaveCurrentCallBestEffort]);

  useEffect(() => {
    if (!currentSession || !currentTarget?.roomId || connectionState !== 'connected') {
      return;
    }

    let disposed = false;
    const roomId = currentTarget.roomId;

    const pulse = async () => {
      try {
        await fetch(`/api/conversations/${roomId}/call/pulse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{}',
          keepalive: true,
        });
      } catch {
        if (!disposed) {
          // Ignore best-effort heartbeat failures. The regular leave flow still exists.
        }
      }
    };

    void pulse();
    const interval = window.setInterval(() => {
      void pulse();
    }, CALL_HEARTBEAT_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [connectionState, currentSession, currentTarget?.roomId]);

  const value = useMemo(
    () => ({
      currentSession,
      currentTarget,
      runtimeError,
      connectionState,
      participantCount,
      isMicrophoneEnabled,
      isTogglingMicrophone,
      microphoneLevel,
      setRuntimeError,
      startSession,
      toggleMicrophone,
      leaveCurrentCall,
      endCurrentCall,
      clearCurrentCall,
    }),
    [
      clearCurrentCall,
      connectionState,
      currentSession,
      currentTarget,
      endCurrentCall,
      isMicrophoneEnabled,
      isTogglingMicrophone,
      leaveCurrentCall,
      microphoneLevel,
      participantCount,
      runtimeError,
      startSession,
      toggleMicrophone,
      handleUnexpectedDisconnect,
    ]
  );

  return (
    <GlobalVoiceContext.Provider value={value}>
      {children}
      {currentSession && currentTarget ? (
        <PersistentVoiceHost
          session={currentSession}
          target={currentTarget}
          onDisconnected={handleUnexpectedDisconnect}
          onRuntimeError={setRuntimeError}
          onRoomAttached={handleRoomAttached}
          onRoomDetached={handleRoomDetached}
          onRoomStateChanged={syncRoomState}
        />
      ) : null}
    </GlobalVoiceContext.Provider>
  );
}

export function useGlobalVoice() {
  return useContext(GlobalVoiceContext);
}

function PersistentVoiceHost({
  onDisconnected,
  onRoomAttached,
  onRoomDetached,
  onRoomStateChanged,
  onRuntimeError,
  session,
}: {
  onDisconnected: () => void;
  onRoomAttached: (room: Room) => void;
  onRoomDetached: (room: Room) => void;
  onRoomStateChanged: (room: Room) => void;
  onRuntimeError: (message: string | null) => void;
  session: PersistentVoiceSession;
}) {
  const [room] = useState(() => createVoiceRoom());
  const latestOnDisconnectedRef = useRef(onDisconnected);
  const latestOnRoomAttachedRef = useRef(onRoomAttached);
  const latestOnRoomDetachedRef = useRef(onRoomDetached);
  const latestOnRoomStateChangedRef = useRef(onRoomStateChanged);
  const latestOnRuntimeErrorRef = useRef(onRuntimeError);
  const hasTriggeredDisconnectRef = useRef(false);

  useEffect(() => {
    latestOnDisconnectedRef.current = onDisconnected;
    latestOnRoomAttachedRef.current = onRoomAttached;
    latestOnRoomDetachedRef.current = onRoomDetached;
    latestOnRoomStateChangedRef.current = onRoomStateChanged;
    latestOnRuntimeErrorRef.current = onRuntimeError;
  }, [onDisconnected, onRoomAttached, onRoomDetached, onRoomStateChanged, onRuntimeError]);

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
      latestOnRuntimeErrorRef.current(formatMicrophoneError(error));
    };
    const handleRoomStateChanged = () => {
      if (disposed) {
        return;
      }
      latestOnRoomStateChangedRef.current(room);
    };

    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.MediaDevicesError, handleMediaDevicesError);
    room.on(RoomEvent.ConnectionStateChanged, handleRoomStateChanged);
    room.on(RoomEvent.ParticipantConnected, handleRoomStateChanged);
    room.on(RoomEvent.ParticipantDisconnected, handleRoomStateChanged);
    room.on(RoomEvent.LocalTrackPublished, handleRoomStateChanged);
    room.on(RoomEvent.LocalTrackUnpublished, handleRoomStateChanged);
    room.on(RoomEvent.TrackMuted, handleRoomStateChanged);
    room.on(RoomEvent.TrackUnmuted, handleRoomStateChanged);
    latestOnRoomAttachedRef.current(room);

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
        latestOnRoomStateChangedRef.current(room);
      } catch (error) {
        if (disposed) {
          return;
        }
        latestOnRuntimeErrorRef.current(
          error instanceof Error ? formatLivekitRuntimeError(error) : 'Failed to connect to the active voice room.'
        );
      }
    })();

    return () => {
      disposed = true;
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.MediaDevicesError, handleMediaDevicesError);
      room.off(RoomEvent.ConnectionStateChanged, handleRoomStateChanged);
      room.off(RoomEvent.ParticipantConnected, handleRoomStateChanged);
      room.off(RoomEvent.ParticipantDisconnected, handleRoomStateChanged);
      room.off(RoomEvent.LocalTrackPublished, handleRoomStateChanged);
      room.off(RoomEvent.LocalTrackUnpublished, handleRoomStateChanged);
      room.off(RoomEvent.TrackMuted, handleRoomStateChanged);
      room.off(RoomEvent.TrackUnmuted, handleRoomStateChanged);
      latestOnRoomDetachedRef.current(room);
      void room.disconnect();
    };
  }, [
    onDisconnected,
    onRoomAttached,
    onRoomDetached,
    onRoomStateChanged,
    room,
    session.audioDeviceId,
    session.roomName,
    session.startWithMicrophone,
    session.token,
    session.url,
  ]);

  return (
    <div className="sr-only">
      <RoomContext.Provider value={room}>
        <RoomAudioRenderer />
      </RoomContext.Provider>
    </div>
  );
}

export function createPreparedPersistentRoom() {
  return createVoiceRoom();
}

export function formatMicrophoneError(error: unknown) {
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

export function formatLivekitRuntimeError(error: Error) {
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
