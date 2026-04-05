'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  RoomContext,
  RoomAudioRenderer,
} from '@livekit/components-react';
import {
  MediaDeviceFailure,
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type LocalTrackPublication,
} from 'livekit-client';
import {
  buildMicrophoneCaptureOptions,
  formatMicrophoneError,
  getMicrophonePermissionState,
  getPendingMicrophoneRuntimeMessage,
  getTimedOutPendingMicrophonePromptMessage,
  isMicrophoneAccessTimeoutError,
  isRecoverableMicrophoneDeviceError,
  type MicrophonePermissionState,
  normalizeAudioInputDeviceId,
  requestRawMicrophoneStream,
} from '@/lib/chat/microphone';
import { chatClientDebug, chatClientError } from '@/lib/chat/debug';
const CALL_HEARTBEAT_INTERVAL_MS = 15_000;
const MICROPHONE_ENABLE_TIMEOUT_MS = 7_000;
const PENDING_MICROPHONE_PROMPT_UI_TIMEOUT_MS = 20_000;

function createVoiceRoom() {
  return new Room({
    adaptiveStream: false,
    dynacast: false,
    disconnectOnPageLeave: false,
    singlePeerConnection: false,
    webAudioMix: false,
  });
}

function sendLeaveBeacon(roomId: string, participantIdentity?: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  const endpoint = `/api/conversations/${roomId}/call/leave`;
  const payload = JSON.stringify({
    participantIdentity: participantIdentity || null,
  });

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
  participantIdentity: string;
  preflightMicrophoneStream?: MediaStream | null;
  pendingMicrophoneStreamPromise?: Promise<MediaStream | null> | null;
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

type MicrophoneRequestOptions = Parameters<typeof requestRawMicrophoneStream>[1];

type GlobalVoiceContextValue = {
  currentSession: PersistentVoiceSession | null;
  currentTarget: PersistentVoiceTarget | null;
  room: Room | null;
  runtimeError: string | null;
  connectionState: string;
  participantCount: number;
  isMicrophoneEnabled: boolean;
  isTogglingMicrophone: boolean;
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
  room: null,
  runtimeError: null,
  connectionState: 'disconnected',
  participantCount: 0,
  isMicrophoneEnabled: false,
  isTogglingMicrophone: false,
  setRuntimeError: () => {},
  startSession: () => {},
  toggleMicrophone: async () => {},
  leaveCurrentCall: async () => {},
  endCurrentCall: async () => {},
  clearCurrentCall: () => {},
});

function stopMediaStream(stream?: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function getCurrentMicrophoneUserAgent() {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
    return '';
  }

  return navigator.userAgent;
}

function getRoomParticipantCount(room: Room, connectionState: string) {
  if (connectionState === 'disconnected') {
    return 0;
  }

  return room.remoteParticipants.size + 1;
}

async function enableRoomMicrophoneWithFallback(
  room: Room,
  audioDeviceId?: string | null,
  onFallbackToDefault?: () => void,
  preflightMicrophoneStream?: MediaStream | null,
  requestOptions?: MicrophoneRequestOptions
) {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  const existingPublication = room.localParticipant.getTrackPublication(
    Track.Source.Microphone
  ) as LocalTrackPublication | undefined;

  const enableExistingPublication = async (deviceId: string) => {
    if (preflightMicrophoneStream) {
      stopMediaStream(preflightMicrophoneStream);
    }

    if (deviceId !== 'default') {
      await room.switchActiveDevice('audioinput', deviceId, true);
    }

    await existingPublication?.unmute();
    return existingPublication;
  };

  const publishFreshTrack = async (deviceId: string) => {
    const normalizedDeviceId = normalizeAudioInputDeviceId(deviceId);
    if (preflightMicrophoneStream) {
      const mediaTrack = preflightMicrophoneStream.getAudioTracks()[0];
      if (!mediaTrack) {
        stopMediaStream(preflightMicrophoneStream);
        throw new Error('No audio track was returned by the browser.');
      }

      chatClientDebug('global-voice.mic.capture.success', {
        roomName: room.name,
        audioDeviceId: normalizedDeviceId,
        strategy: 'preflight-stream',
      });

      try {
        chatClientDebug('global-voice.mic.publish.start', {
          roomName: room.name,
          audioDeviceId: normalizedDeviceId,
          strategy: 'preflight-media-stream-track',
        });
        const publication = await room.localParticipant.publishTrack(mediaTrack, {
          source: Track.Source.Microphone,
        });
        chatClientDebug('global-voice.mic.publish.success', {
          roomName: room.name,
          audioDeviceId: normalizedDeviceId,
          strategy: 'preflight-media-stream-track',
        });
        return publication;
      } catch (error) {
        stopMediaStream(preflightMicrophoneStream);
        chatClientError('global-voice.mic.publish.error', {
          roomName: room.name,
          audioDeviceId: normalizedDeviceId,
          strategy: 'preflight-media-stream-track',
          failure: MediaDeviceFailure.getFailure(error),
          error: error instanceof Error ? error : new Error('Failed to publish microphone track'),
        });
        throw error;
      }
    }

    if (normalizedDeviceId === 'default') {
      chatClientDebug('global-voice.mic.capture.start', {
        roomName: room.name,
        audioDeviceId: normalizedDeviceId,
        strategy: 'raw-default-stream',
      });
      const stream = await requestRawMicrophoneStream('default', requestOptions);
      const mediaTrack = stream.getAudioTracks()[0];
      if (!mediaTrack) {
        stream.getTracks().forEach((streamTrack) => streamTrack.stop());
        throw new Error('No audio track was returned by the browser.');
      }

      chatClientDebug('global-voice.mic.capture.success', {
        roomName: room.name,
        audioDeviceId: normalizedDeviceId,
        strategy: 'raw-default-stream',
      });

      try {
        chatClientDebug('global-voice.mic.publish.start', {
          roomName: room.name,
          audioDeviceId: normalizedDeviceId,
          strategy: 'raw-media-stream-track',
        });
        const publication = await room.localParticipant.publishTrack(mediaTrack, {
          source: Track.Source.Microphone,
        });
        chatClientDebug('global-voice.mic.publish.success', {
          roomName: room.name,
          audioDeviceId: normalizedDeviceId,
          strategy: 'raw-media-stream-track',
        });
        return publication;
      } catch (error) {
        stream.getTracks().forEach((streamTrack) => streamTrack.stop());
        chatClientError('global-voice.mic.publish.error', {
          roomName: room.name,
          audioDeviceId: normalizedDeviceId,
          strategy: 'raw-media-stream-track',
          failure: MediaDeviceFailure.getFailure(error),
          error: error instanceof Error ? error : new Error('Failed to publish microphone track'),
        });
        throw error;
      }
    }

    chatClientDebug('global-voice.mic.capture.start', {
      roomName: room.name,
      audioDeviceId: normalizedDeviceId,
      strategy: 'sdk-create-local-track',
    });
    const track = await createLocalAudioTrack(buildMicrophoneCaptureOptions(normalizedDeviceId));
    chatClientDebug('global-voice.mic.capture.success', {
      roomName: room.name,
      audioDeviceId: normalizedDeviceId,
      strategy: 'sdk-create-local-track',
    });

    try {
      chatClientDebug('global-voice.mic.publish.start', {
        roomName: room.name,
        audioDeviceId: normalizedDeviceId,
        strategy: 'sdk-local-track',
      });
      const publication = await room.localParticipant.publishTrack(track);
      chatClientDebug('global-voice.mic.publish.success', {
        roomName: room.name,
        audioDeviceId: normalizedDeviceId,
        strategy: 'sdk-local-track',
      });
      return publication;
    } catch (error) {
      track.stop();
      chatClientError('global-voice.mic.publish.error', {
        roomName: room.name,
        audioDeviceId: normalizedDeviceId,
        strategy: 'sdk-local-track',
        failure: MediaDeviceFailure.getFailure(error),
        error: error instanceof Error ? error : new Error('Failed to publish microphone track'),
      });
      throw error;
    }
  };

  try {
    return existingPublication
      ? await enableExistingPublication(normalizedDeviceId)
      : await publishFreshTrack(normalizedDeviceId);
  } catch (error) {
    if (normalizedDeviceId !== 'default' && isRecoverableMicrophoneDeviceError(error)) {
      onFallbackToDefault?.();
      return existingPublication
        ? await enableExistingPublication('default')
        : await publishFreshTrack('default');
    }
    throw error;
  }
}

async function enableRoomMicrophoneWithTimeout(
  room: Room,
  audioDeviceId?: string | null,
  onFallbackToDefault?: () => void,
  preflightMicrophoneStream?: MediaStream | null,
  requestOptions?: MicrophoneRequestOptions
) {
  const timeoutMs = requestOptions?.timeoutMs ?? MICROPHONE_ENABLE_TIMEOUT_MS;

  return await Promise.race([
    enableRoomMicrophoneWithFallback(
      room,
      audioDeviceId,
      onFallbackToDefault,
      preflightMicrophoneStream,
      requestOptions
    ),
    new Promise<LocalTrackPublication | undefined>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error('Timed out while starting the microphone.'));
      }, timeoutMs);
    }),
  ]);
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
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  const microphoneActivationIntentRef = useRef(false);
  const microphoneAutoRetryInFlightRef = useRef(false);
  const lastObservedMicrophonePermissionStateRef = useRef<MicrophonePermissionState>('unknown');

  const leaveCurrentCallBestEffort = useCallback((roomId: string | null | undefined) => {
    if (!roomId) {
      return;
    }

    sendLeaveBeacon(roomId, currentSession?.participantIdentity);
  }, [currentSession?.participantIdentity]);

  const syncRoomState = useCallback(
    (room: Room | null) => {
      if (!room) {
        setConnectionState('disconnected');
        setParticipantCount(0);
        setIsMicrophoneEnabled(false);
        return;
      }

      const nextConnectionState = String((room as Room & { state?: string }).state || 'connected');
      const nextMicrophoneEnabled = Boolean(
        (room.localParticipant as typeof room.localParticipant & { isMicrophoneEnabled?: boolean }).isMicrophoneEnabled
      );

      setConnectionState(nextConnectionState);
      setParticipantCount(getRoomParticipantCount(room, nextConnectionState));
      setIsMicrophoneEnabled(nextMicrophoneEnabled);
    },
    []
  );

  const handleAudioDeviceFallbackToDefault = useCallback(() => {
    setCurrentSession((current) => (current ? { ...current, audioDeviceId: 'default' } : current));
  }, []);

  const clearPendingMicrophoneStreamPromise = useCallback(() => {
    setCurrentSession((current) =>
      current?.pendingMicrophoneStreamPromise
        ? { ...current, pendingMicrophoneStreamPromise: null }
        : current
    );
  }, []);

  const clearCurrentCall = useCallback(() => {
    chatClientDebug('global-voice.clear-current-call', {
      roomId: currentTarget?.roomId || null,
      participantIdentity: currentSession?.participantIdentity || null,
      connectionState,
    });
    stopMediaStream(currentSession?.preflightMicrophoneStream);
    microphoneActivationIntentRef.current = false;
    microphoneAutoRetryInFlightRef.current = false;
    lastObservedMicrophonePermissionStateRef.current = 'unknown';
    roomRef.current = null;
    setActiveRoom(null);
    setConnectionState('disconnected');
    setParticipantCount(0);
    setIsMicrophoneEnabled(false);
    setIsTogglingMicrophone(false);
    setCurrentSession(null);
    setCurrentTarget(null);
    setRuntimeError(null);
    queryClient.invalidateQueries({ queryKey: ['live-calls'] });
    queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
  }, [
    connectionState,
    currentSession?.participantIdentity,
    currentSession?.preflightMicrophoneStream,
    currentTarget?.roomId,
    queryClient,
  ]);

  const failCurrentCall = useCallback(
    (message: string) => {
      chatClientError('global-voice.fail-current-call', {
        roomId: currentTarget?.roomId || null,
        participantIdentity: currentSession?.participantIdentity || null,
        message,
      });
      stopMediaStream(currentSession?.preflightMicrophoneStream);
      microphoneActivationIntentRef.current = false;
      microphoneAutoRetryInFlightRef.current = false;
      lastObservedMicrophonePermissionStateRef.current = 'unknown';
      roomRef.current = null;
      setActiveRoom(null);
      setConnectionState('disconnected');
      setParticipantCount(0);
      setIsMicrophoneEnabled(false);
      setIsTogglingMicrophone(false);
      setCurrentSession(null);
      setCurrentTarget(null);
      setRuntimeError(message);
      queryClient.invalidateQueries({ queryKey: ['live-calls'] });
      queryClient.invalidateQueries({ queryKey: ['project-chat-bootstrap'] });
    },
    [currentSession?.participantIdentity, currentSession?.preflightMicrophoneStream, currentTarget?.roomId, queryClient]
  );

  const startSession = useCallback(
    (input: { session: PersistentVoiceSession; target: PersistentVoiceTarget }) => {
      chatClientDebug('global-voice.start-session', {
        roomId: input.target.roomId,
        roomName: input.session.roomName,
        participantIdentity: input.session.participantIdentity,
        audioDeviceId: input.session.audioDeviceId,
        startWithMicrophone: input.session.startWithMicrophone,
      });
      setRuntimeError(null);
      setConnectionState('connecting');
      setParticipantCount(0);
      setIsMicrophoneEnabled(false);
      microphoneActivationIntentRef.current = Boolean(
        input.session.startWithMicrophone ||
          input.session.preflightMicrophoneStream ||
          input.session.pendingMicrophoneStreamPromise
      );
      microphoneAutoRetryInFlightRef.current = false;
      lastObservedMicrophonePermissionStateRef.current = 'unknown';
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
      chatClientDebug('global-voice.toggle-microphone.blocked', {
        hasRoom: Boolean(room),
        connectionState,
      });
      throw new Error('Wait for the call to connect before changing your microphone.');
    }

    try {
      setIsTogglingMicrophone(true);
      setRuntimeError(null);
      const targetEnabled = !isMicrophoneEnabled;
      chatClientDebug('global-voice.toggle-microphone.start', {
        roomId: currentTarget?.roomId || null,
        targetEnabled,
        audioDeviceId: currentSession?.audioDeviceId || null,
      });

      if (targetEnabled) {
        microphoneActivationIntentRef.current = true;
        if (currentSession?.pendingMicrophoneStreamPromise) {
          chatClientDebug('global-voice.toggle-microphone.pending', {
            roomId: currentTarget?.roomId || null,
            audioDeviceId: currentSession.audioDeviceId,
          });
          setRuntimeError((current) => {
            if (
              current &&
              current.toLowerCase().includes('timed out while waiting for the browser prompt')
            ) {
              return current;
            }
            return getPendingMicrophoneRuntimeMessage(getCurrentMicrophoneUserAgent());
          });
          return;
        }

        await enableRoomMicrophoneWithTimeout(
          room,
          currentSession?.audioDeviceId,
          () => {
            setCurrentSession((current) => (current ? { ...current, audioDeviceId: 'default' } : current));
          },
          undefined,
          {
            interactive: true,
            timeoutMs: MICROPHONE_ENABLE_TIMEOUT_MS,
          }
        );
      } else {
        microphoneActivationIntentRef.current = false;
        const microphonePublication = room.localParticipant.getTrackPublication(
          Track.Source.Microphone
        ) as LocalTrackPublication | undefined;
        if (microphonePublication) {
          await microphonePublication.mute();
        } else {
          await room.localParticipant.setMicrophoneEnabled(false);
        }
      }

      syncRoomState(room);
      chatClientDebug('global-voice.toggle-microphone.success', {
        roomId: currentTarget?.roomId || null,
        targetEnabled,
      });
    } catch (error) {
      const message = formatMicrophoneError(error);
      setRuntimeError(message);
      chatClientError('global-voice.toggle-microphone.error', {
        roomId: currentTarget?.roomId || null,
        targetEnabled: !isMicrophoneEnabled,
        failure: MediaDeviceFailure.getFailure(error),
        lastMicrophoneError:
          (room.localParticipant as typeof room.localParticipant & { lastMicrophoneError?: Error })
            .lastMicrophoneError || null,
        error: error instanceof Error ? error : new Error(message),
      });
      return;
    } finally {
      setIsTogglingMicrophone(false);
    }
  }, [
    connectionState,
    currentSession?.audioDeviceId,
    currentSession?.pendingMicrophoneStreamPromise,
    currentTarget?.roomId,
    isMicrophoneEnabled,
    syncRoomState,
  ]);

  const handleRoomAttached = useCallback(
    (room: Room) => {
      chatClientDebug('global-voice.room.attached', {
        roomName: room.name,
      });
      roomRef.current = room;
      setActiveRoom(room);
      syncRoomState(room);
    },
    [syncRoomState]
  );

  const handleRoomDetached = useCallback(
    (room: Room) => {
      chatClientDebug('global-voice.room.detached', {
        roomName: room.name,
      });
      if (roomRef.current === room) {
        roomRef.current = null;
      }
      setActiveRoom((current) => (current === room ? null : current));
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
        chatClientDebug('global-voice.leave.start', {
          roomId: currentTarget.roomId,
          participantIdentity: currentSession?.participantIdentity || null,
        });
        await fetch(`/api/conversations/${currentTarget.roomId}/call/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantIdentity: currentSession?.participantIdentity || null,
        }),
      });
      chatClientDebug('global-voice.leave.success', {
        roomId: currentTarget.roomId,
      });
    } finally {
      clearCurrentCall();
    }
  }, [clearCurrentCall, currentSession?.participantIdentity, currentTarget?.roomId]);

  const endCurrentCall = useCallback(async () => {
    if (!currentTarget?.roomId) {
      clearCurrentCall();
      return;
    }

    try {
      chatClientDebug('global-voice.end.start', {
        roomId: currentTarget.roomId,
      });
      await fetch(`/api/conversations/${currentTarget.roomId}/call/end`, { method: 'POST' });
      chatClientDebug('global-voice.end.success', {
        roomId: currentTarget.roomId,
      });
    } finally {
      clearCurrentCall();
    }
  }, [clearCurrentCall, currentTarget?.roomId]);

  const handleUnexpectedDisconnect = useCallback(() => {
    chatClientDebug('global-voice.unexpected-disconnect', {
      roomId: currentTarget?.roomId || null,
      participantIdentity: currentSession?.participantIdentity || null,
    });
    leaveCurrentCallBestEffort(currentTarget?.roomId);
    clearCurrentCall();
  }, [clearCurrentCall, currentSession?.participantIdentity, currentTarget?.roomId, leaveCurrentCallBestEffort]);

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
          body: JSON.stringify({
            participantIdentity: currentSession.participantIdentity,
          }),
          keepalive: true,
        });
      } catch {
        if (!disposed) {
          chatClientError('global-voice.heartbeat.error', {
            roomId,
            participantIdentity: currentSession.participantIdentity,
          });
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

  useEffect(() => {
    if (!currentSession || !currentTarget?.roomId || !microphoneActivationIntentRef.current) {
      return;
    }

    const shouldWatchPermissionRecovery =
      !isMicrophoneEnabled &&
      (Boolean(currentSession.pendingMicrophoneStreamPromise) ||
        Boolean(
          runtimeError &&
            runtimeError.toLowerCase().includes('timed out while waiting for the browser prompt')
        ));

    if (!shouldWatchPermissionRecovery) {
      return;
    }

    let disposed = false;
    let permissionStatusCleanup = () => {};

    const maybeAutoRetryMicrophone = async (
      source: 'initial' | 'poll' | 'focus' | 'visibilitychange' | 'permission-change'
    ) => {
      const state = await getMicrophonePermissionState({ silent: true });
      if (disposed) {
        return;
      }

      const previousState = lastObservedMicrophonePermissionStateRef.current;
      if (previousState !== state) {
        chatClientDebug('global-voice.permission.watch.state', {
          roomId: currentTarget.roomId,
          state,
          source,
        });
        lastObservedMicrophonePermissionStateRef.current = state;
      }

      const shouldAutoRetry =
        state === 'granted' &&
        previousState !== 'granted' &&
        microphoneActivationIntentRef.current &&
        connectionState === 'connected' &&
        !isMicrophoneEnabled &&
        !isTogglingMicrophone &&
        !currentSession.pendingMicrophoneStreamPromise &&
        Boolean(
          runtimeError &&
            runtimeError.toLowerCase().includes('timed out while waiting for the browser prompt')
        );

      if (!shouldAutoRetry || microphoneAutoRetryInFlightRef.current) {
        return;
      }

      microphoneAutoRetryInFlightRef.current = true;
      chatClientDebug('global-voice.permission.autoretry.start', {
        roomId: currentTarget.roomId,
        source,
      });

      try {
        await toggleMicrophone();
        chatClientDebug('global-voice.permission.autoretry.finish', {
          roomId: currentTarget.roomId,
          source,
        });
      } finally {
        microphoneAutoRetryInFlightRef.current = false;
      }
    };

    const handleFocus = () => {
      void maybeAutoRetryMicrophone('focus');
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void maybeAutoRetryMicrophone('visibilitychange');
      }
    };

    void maybeAutoRetryMicrophone('initial');

    const permissionPoll = window.setInterval(() => {
      void maybeAutoRetryMicrophone('poll');
    }, 1_000);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      void navigator.permissions
        .query({
          name: 'microphone' as PermissionName,
        })
        .then((status) => {
          if (disposed) {
            return;
          }

          const handlePermissionChange = () => {
            void maybeAutoRetryMicrophone('permission-change');
          };

          if (typeof status.addEventListener === 'function') {
            status.addEventListener('change', handlePermissionChange);
            permissionStatusCleanup = () => {
              status.removeEventListener('change', handlePermissionChange);
            };
          } else {
            status.onchange = handlePermissionChange;
            permissionStatusCleanup = () => {
              if (status.onchange === handlePermissionChange) {
                status.onchange = null;
              }
            };
          }
        })
        .catch(() => {});
    }

    return () => {
      disposed = true;
      permissionStatusCleanup();
      window.clearInterval(permissionPoll);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    connectionState,
    currentSession,
    currentTarget?.roomId,
    isMicrophoneEnabled,
    isTogglingMicrophone,
    runtimeError,
    toggleMicrophone,
  ]);

  const value = useMemo(
    () => ({
      currentSession,
      currentTarget,
      room: activeRoom,
      runtimeError,
      connectionState,
      participantCount,
      isMicrophoneEnabled,
      isTogglingMicrophone,
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
      activeRoom,
      endCurrentCall,
      isMicrophoneEnabled,
      isTogglingMicrophone,
      leaveCurrentCall,
      participantCount,
      runtimeError,
      startSession,
      toggleMicrophone,
    ]
  );

  return (
    <GlobalVoiceContext.Provider value={value}>
      {children}
      {currentSession && currentTarget ? (
        <PersistentVoiceHost
          onConnectionFailed={failCurrentCall}
          shouldRenderAudio={participantCount > 1 && connectionState === 'connected'}
          session={currentSession}
          onAudioDeviceFallbackToDefault={handleAudioDeviceFallbackToDefault}
          onDisconnected={handleUnexpectedDisconnect}
          onPendingMicrophoneSettled={clearPendingMicrophoneStreamPromise}
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
  onAudioDeviceFallbackToDefault,
  onConnectionFailed,
  onDisconnected,
  onPendingMicrophoneSettled,
  onRoomAttached,
  onRoomDetached,
  onRoomStateChanged,
  onRuntimeError,
  session,
  shouldRenderAudio,
}: {
  onAudioDeviceFallbackToDefault: () => void;
  onConnectionFailed: (message: string) => void;
  onDisconnected: () => void;
  onPendingMicrophoneSettled: () => void;
  onRoomAttached: (room: Room) => void;
  onRoomDetached: (room: Room) => void;
  onRoomStateChanged: (room: Room) => void;
  onRuntimeError: (message: string | null) => void;
  session: PersistentVoiceSession;
  shouldRenderAudio: boolean;
}) {
  const [room] = useState(() => createVoiceRoom());
  const latestOnConnectionFailedRef = useRef(onConnectionFailed);
  const latestOnDisconnectedRef = useRef(onDisconnected);
  const latestOnPendingMicrophoneSettledRef = useRef(onPendingMicrophoneSettled);
  const latestOnRoomAttachedRef = useRef(onRoomAttached);
  const latestOnRoomDetachedRef = useRef(onRoomDetached);
  const latestOnRoomStateChangedRef = useRef(onRoomStateChanged);
  const latestOnRuntimeErrorRef = useRef(onRuntimeError);
  const hasTriggeredDisconnectRef = useRef(false);

  useEffect(() => {
    latestOnConnectionFailedRef.current = onConnectionFailed;
    latestOnDisconnectedRef.current = onDisconnected;
    latestOnPendingMicrophoneSettledRef.current = onPendingMicrophoneSettled;
    latestOnRoomAttachedRef.current = onRoomAttached;
    latestOnRoomDetachedRef.current = onRoomDetached;
    latestOnRoomStateChangedRef.current = onRoomStateChanged;
    latestOnRuntimeErrorRef.current = onRuntimeError;
  }, [
    onConnectionFailed,
    onDisconnected,
    onPendingMicrophoneSettled,
    onRoomAttached,
    onRoomDetached,
    onRoomStateChanged,
    onRuntimeError,
  ]);

  useEffect(() => {
    hasTriggeredDisconnectRef.current = false;
  }, [session.roomName]);

  useEffect(() => {
    let disposed = false;
    let didConnect = false;

  const handleDisconnected = () => {
      if (disposed || hasTriggeredDisconnectRef.current) {
        return;
      }
      hasTriggeredDisconnectRef.current = true;
      chatClientDebug('global-voice.host.disconnected-event', {
        roomName: session.roomName,
      });
      latestOnDisconnectedRef.current();
    };

    const handleMediaDevicesError = (error: Error) => {
      if (disposed) {
        return;
      }
      chatClientError('global-voice.host.media-devices-error', {
        roomName: session.roomName,
        failure: MediaDeviceFailure.getFailure(error),
        lastMicrophoneError:
          (room.localParticipant as typeof room.localParticipant & { lastMicrophoneError?: Error })
            .lastMicrophoneError || null,
        error,
      });
      latestOnRuntimeErrorRef.current(formatMicrophoneError(error));
    };
    const handleRoomStateChanged = () => {
      if (disposed) {
        return;
      }
      chatClientDebug('global-voice.host.room-state-changed', {
        roomName: session.roomName,
        state: String((room as Room & { state?: string }).state || 'unknown'),
        remoteParticipants: room.remoteParticipants.size,
        isMicrophoneEnabled: Boolean(
          (room.localParticipant as typeof room.localParticipant & { isMicrophoneEnabled?: boolean }).isMicrophoneEnabled
        ),
      });
      latestOnRoomStateChangedRef.current(room);
    };

    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.Connected, handleRoomStateChanged);
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
        chatClientDebug('global-voice.host.connect.start', {
          roomName: session.roomName,
          url: session.url,
          participantIdentity: session.participantIdentity,
          startWithMicrophone: session.startWithMicrophone,
          audioDeviceId: session.audioDeviceId,
        });
        await room.connect(session.url, session.token, {
          autoSubscribe: true,
          maxRetries: 0,
          peerConnectionTimeout: 30_000,
          websocketTimeout: 30_000,
        });
        didConnect = true;

        if (disposed) {
          return;
        }

        latestOnRoomStateChangedRef.current(room);
        chatClientDebug('global-voice.host.connect.success', {
          roomName: session.roomName,
          participantIdentity: session.participantIdentity,
        });

        if (session.startWithMicrophone) {
          chatClientDebug('global-voice.host.mic.enable.start', {
            roomName: session.roomName,
            audioDeviceId: session.audioDeviceId,
          });

          try {
            await enableRoomMicrophoneWithTimeout(room, session.audioDeviceId, () => {
              onAudioDeviceFallbackToDefault();
              latestOnRuntimeErrorRef.current(
                'The selected microphone could not start in this browser, so TaskNebula switched to your system default microphone.'
              );
            }, session.preflightMicrophoneStream, {
              timeoutMs: MICROPHONE_ENABLE_TIMEOUT_MS,
            });
            chatClientDebug('global-voice.host.mic.enable.success', {
              roomName: session.roomName,
              audioDeviceId: session.audioDeviceId,
            });
          } catch (error) {
            chatClientError('global-voice.host.mic.enable.error', {
              roomName: session.roomName,
              audioDeviceId: session.audioDeviceId,
              failure: MediaDeviceFailure.getFailure(error),
              lastMicrophoneError:
                (room.localParticipant as typeof room.localParticipant & { lastMicrophoneError?: Error })
                  .lastMicrophoneError || null,
              error: error instanceof Error ? error : new Error('Failed to enable microphone during connect'),
            });
            latestOnRuntimeErrorRef.current(formatMicrophoneError(error));
          } finally {
            if (!disposed) {
              latestOnRoomStateChangedRef.current(room);
            }
          }
        } else if (session.pendingMicrophoneStreamPromise) {
          chatClientDebug('global-voice.host.mic.pending.start', {
            roomName: session.roomName,
            audioDeviceId: session.audioDeviceId,
          });

          let pendingPromptTimedOut = false;
          const pendingPromptTimeout = window.setTimeout(() => {
            if (disposed) {
              return;
            }

            pendingPromptTimedOut = true;
            chatClientError('global-voice.host.mic.pending.timeout', {
              roomName: session.roomName,
              audioDeviceId: session.audioDeviceId,
              timeoutMs: PENDING_MICROPHONE_PROMPT_UI_TIMEOUT_MS,
              error: new Error(
                `Microphone access was still waiting for the browser prompt after ${PENDING_MICROPHONE_PROMPT_UI_TIMEOUT_MS}ms.`
              ),
            });
            latestOnRuntimeErrorRef.current(
              getTimedOutPendingMicrophonePromptMessage(getCurrentMicrophoneUserAgent())
            );
          }, PENDING_MICROPHONE_PROMPT_UI_TIMEOUT_MS);

          void session.pendingMicrophoneStreamPromise
            .then(async (stream) => {
              window.clearTimeout(pendingPromptTimeout);
              latestOnPendingMicrophoneSettledRef.current();

              if (!stream) {
                return;
              }

              if (disposed) {
                stopMediaStream(stream);
                return;
              }

              chatClientDebug('global-voice.host.mic.pending.resolve', {
                roomName: session.roomName,
                audioDeviceId: session.audioDeviceId,
              });

              try {
                await enableRoomMicrophoneWithTimeout(
                  room,
                  session.audioDeviceId,
                  () => {
                    onAudioDeviceFallbackToDefault();
                    latestOnRuntimeErrorRef.current(
                      'The selected microphone could not start in this browser, so TaskNebula switched to your system default microphone.'
                    );
                  },
                  stream,
                  {
                    timeoutMs: MICROPHONE_ENABLE_TIMEOUT_MS,
                  }
                );
                chatClientDebug('global-voice.host.mic.pending.success', {
                  roomName: session.roomName,
                  audioDeviceId: session.audioDeviceId,
                });
                latestOnRuntimeErrorRef.current(null);
              } catch (error) {
                chatClientError('global-voice.host.mic.pending.error', {
                  roomName: session.roomName,
                  audioDeviceId: session.audioDeviceId,
                  failure: MediaDeviceFailure.getFailure(error),
                  lastMicrophoneError:
                    (room.localParticipant as typeof room.localParticipant & { lastMicrophoneError?: Error })
                      .lastMicrophoneError || null,
                  error:
                    error instanceof Error
                      ? error
                      : new Error('Failed to enable microphone after the background prompt resolved'),
                });

                if (!isMicrophoneAccessTimeoutError(error)) {
                  latestOnRuntimeErrorRef.current(formatMicrophoneError(error));
                }
              } finally {
                if (!disposed) {
                  latestOnRoomStateChangedRef.current(room);
                }
              }
            })
            .catch((error) => {
              window.clearTimeout(pendingPromptTimeout);
              latestOnPendingMicrophoneSettledRef.current();

              if (disposed) {
                return;
              }

              if (isMicrophoneAccessTimeoutError(error)) {
                chatClientError('global-voice.host.mic.pending.final-timeout', {
                  roomName: session.roomName,
                  audioDeviceId: session.audioDeviceId,
                  error:
                    error instanceof Error
                      ? error
                      : new Error('Microphone access timed out after the room connected'),
                });
                if (!pendingPromptTimedOut) {
                  latestOnRuntimeErrorRef.current(
                    getTimedOutPendingMicrophonePromptMessage(getCurrentMicrophoneUserAgent())
                  );
                }
                return;
              }

              chatClientError('global-voice.host.mic.pending.error', {
                roomName: session.roomName,
                audioDeviceId: session.audioDeviceId,
                failure: MediaDeviceFailure.getFailure(error),
                lastMicrophoneError:
                  (room.localParticipant as typeof room.localParticipant & { lastMicrophoneError?: Error })
                    .lastMicrophoneError || null,
                error:
                  error instanceof Error
                    ? error
                    : new Error('Microphone access failed after the room connected'),
              });
              latestOnRuntimeErrorRef.current(formatMicrophoneError(error));
            });
        }
      } catch (error) {
        if (disposed) {
          return;
        }
        const message =
          error instanceof Error ? formatLivekitRuntimeError(error) : 'Failed to connect to the active voice room.';
        chatClientError('global-voice.host.connect.error', {
          roomName: session.roomName,
          participantIdentity: session.participantIdentity,
          didConnect,
          error: error instanceof Error ? error : new Error(message),
        });
        if (!didConnect) {
          latestOnConnectionFailedRef.current(message || 'Failed to connect to the active voice room.');
          return;
        }
        latestOnRuntimeErrorRef.current(message);
      }
    })();

    return () => {
      disposed = true;
      chatClientDebug('global-voice.host.cleanup', {
        roomName: session.roomName,
        participantIdentity: session.participantIdentity,
      });
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.Connected, handleRoomStateChanged);
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
    room,
    session.roomName,
    session.token,
    session.url,
  ]);

  return (
    <div className="sr-only">
      <RoomContext.Provider value={room}>
        {shouldRenderAudio ? <RoomAudioRenderer /> : null}
      </RoomContext.Provider>
    </div>
  );
}

export function createPreparedPersistentRoom() {
  return createVoiceRoom();
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
