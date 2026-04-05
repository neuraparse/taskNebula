'use client';

import { useCallback, useEffect, useState } from 'react';

export const VOICE_PREFERENCES_STORAGE_KEY = 'tasknebula-chat-voice-settings';

export function useStoredVoicePreferences() {
  const [storedAudioDeviceId, setStoredAudioDeviceId] = useState('default');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(VOICE_PREFERENCES_STORAGE_KEY);
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
      const raw = window.localStorage.getItem(VOICE_PREFERENCES_STORAGE_KEY);
      const current = raw ? (JSON.parse(raw) as { audioDeviceId?: string }) : {};
      window.localStorage.setItem(
        VOICE_PREFERENCES_STORAGE_KEY,
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
