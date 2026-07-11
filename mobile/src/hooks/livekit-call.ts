import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { AudioSession, AndroidAudioTypePresets } from '@livekit/react-native';
import { Room, RoomEvent } from 'livekit-client';
import { useTranslation } from 'react-i18next';

import * as api from '@/api/endpoints';

const CALL_HEARTBEAT_INTERVAL_MS = 15_000;

export type NativeCallStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'leaving';

export type NativeCallSession = {
  roomId: string;
  roomTitle: string;
  participantIdentity: string;
  livekitRoomName: string;
  livekitUrl: string;
};

type JoinCallInput = {
  roomId: string;
  roomTitle: string;
};

type UseNativeConversationCallOptions = {
  onCallChanged?: () => void;
};

function createClientSessionId(): string {
  return `mobile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function configureAudioSession() {
  await AudioSession.configureAudio({
    android: {
      preferredOutputList: ['bluetooth', 'headset', 'speaker', 'earpiece'],
      audioTypeOptions: AndroidAudioTypePresets.communication,
    },
    ios: {
      defaultOutput: 'speaker',
    },
  });
  await AudioSession.startAudioSession();
}

export function useNativeConversationCall(options: UseNativeConversationCallOptions = {}) {
  const { t } = useTranslation();
  const onCallChangedRef = useRef(options.onCallChanged);
  const roomRef = useRef<Room | null>(null);
  const sessionRef = useRef<NativeCallSession | null>(null);
  const leavingRef = useRef(false);
  const clientSessionIdRef = useRef(createClientSessionId());
  const [session, setSession] = useState<NativeCallSession | null>(null);
  const [status, setStatus] = useState<NativeCallStatus>('idle');
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    onCallChangedRef.current = options.onCallChanged;
  }, [options.onCallChanged]);

  const requestMicrophonePermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: t('chat.microphonePermissionTitle'),
      message: t('chat.microphonePermissionDescription'),
      buttonPositive: t('common.continue'),
      buttonNegative: t('common.cancel'),
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }, [t]);

  const disconnectLocalRoom = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      room.removeAllListeners();
      room.disconnect();
      roomRef.current = null;
    }
    await AudioSession.stopAudioSession().catch(() => {});
  }, []);

  const leave = useCallback(async () => {
    const activeSession = sessionRef.current;
    leavingRef.current = true;
    setStatus('leaving');
    await disconnectLocalRoom();
    sessionRef.current = null;
    setSession(null);
    setMutedState(false);

    if (activeSession) {
      await api
        .leaveConversationCall(activeSession.roomId, {
          participantIdentity: activeSession.participantIdentity,
        })
        .catch(() => {});
      onCallChangedRef.current?.();
    }

    leavingRef.current = false;
    setStatus('idle');
  }, [disconnectLocalRoom]);

  const join = useCallback(
    async ({ roomId, roomTitle }: JoinCallInput) => {
      const hasMicrophonePermission = await requestMicrophonePermission();
      if (!hasMicrophonePermission) {
        throw new Error(t('chat.microphonePermissionDenied'));
      }

      if (sessionRef.current) {
        await leave();
      }

      setStatus('connecting');
      let callToken: Awaited<ReturnType<typeof api.createConversationCallToken>>;
      try {
        callToken = await api.createConversationCallToken(roomId, {
          clientSessionId: clientSessionIdRef.current,
        });
      } catch (error) {
        setStatus('idle');
        throw error;
      }

      const nextSession: NativeCallSession = {
        roomId,
        roomTitle,
        participantIdentity: callToken.participantIdentity,
        livekitRoomName: callToken.roomName,
        livekitUrl: callToken.url,
      };

      const room = new Room({
        adaptiveStream: false,
        dynacast: false,
      });
      roomRef.current = room;
      sessionRef.current = nextSession;
      setSession(nextSession);
      onCallChangedRef.current?.();

      room.on(RoomEvent.Connected, () => {
        setStatus('connected');
      });
      room.on(RoomEvent.Reconnecting, () => {
        setStatus('reconnecting');
      });
      room.on(RoomEvent.Reconnected, () => {
        setStatus('connected');
      });
      room.on(RoomEvent.Disconnected, () => {
        void AudioSession.stopAudioSession().catch(() => {});
        room.removeAllListeners();
        roomRef.current = null;
        if (!leavingRef.current) {
          sessionRef.current = null;
          setSession(null);
          setMutedState(false);
          setStatus('idle');
          void api
            .leaveConversationCall(nextSession.roomId, {
              participantIdentity: nextSession.participantIdentity,
            })
            .finally(() => {
              onCallChangedRef.current?.();
            });
        }
      });

      try {
        await configureAudioSession();
        await room.connect(callToken.url, callToken.token, { autoSubscribe: true });
        await room.localParticipant.setMicrophoneEnabled(true);
        setMutedState(false);
        setStatus('connected');
      } catch (error) {
        await disconnectLocalRoom();
        sessionRef.current = null;
        setSession(null);
        setMutedState(false);
        setStatus('idle');
        await api
          .leaveConversationCall(roomId, { participantIdentity: callToken.participantIdentity })
          .catch(() => {});
        onCallChangedRef.current?.();
        throw error;
      }
    },
    [disconnectLocalRoom, leave, requestMicrophonePermission, t],
  );

  const setMuted = useCallback(async (nextMuted: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(!nextMuted);
    setMutedState(nextMuted);
  }, []);

  useEffect(() => {
    if (status !== 'connected' || !session) return undefined;

    let disposed = false;
    const pulse = async () => {
      try {
        await api.pulseConversationCall(session.roomId, {
          participantIdentity: session.participantIdentity,
        });
      } catch {
        if (!disposed) {
          onCallChangedRef.current?.();
        }
      }
    };

    void pulse();
    const interval = setInterval(() => {
      void pulse();
    }, CALL_HEARTBEAT_INTERVAL_MS);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [session, status]);

  useEffect(
    () => () => {
      const activeSession = sessionRef.current;
      const room = roomRef.current;
      room?.removeAllListeners();
      room?.disconnect();
      roomRef.current = null;
      sessionRef.current = null;
      void AudioSession.stopAudioSession().catch(() => {});
      if (activeSession) {
        void api.leaveConversationCall(activeSession.roomId, {
          participantIdentity: activeSession.participantIdentity,
        });
      }
    },
    [],
  );

  return {
    join,
    leave,
    muted,
    session,
    setMuted,
    status,
    isBusy: status === 'connecting' || status === 'leaving',
    isConnected: status === 'connected' || status === 'reconnecting',
  };
}
