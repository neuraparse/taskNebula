'use client';

import { useCallback, useEffect, useState } from 'react';

export const VOICE_PREFERENCES_STORAGE_KEY = 'tasknebula-chat-voice-settings';

export type StoredVoicePreferences = {
  audioDeviceId?: string;
  audioDeviceLabel?: string;
  audioDeviceGroupId?: string;
};

function areStoredVoicePreferencesEqual(
  left: StoredVoicePreferences,
  right: StoredVoicePreferences
) {
  return (
    (left.audioDeviceId || 'default') === (right.audioDeviceId || 'default') &&
    (left.audioDeviceLabel || undefined) === (right.audioDeviceLabel || undefined) &&
    (left.audioDeviceGroupId || undefined) === (right.audioDeviceGroupId || undefined)
  );
}

function sanitizeStoredVoicePreferences(value?: StoredVoicePreferences | null): StoredVoicePreferences {
  const audioDeviceId = value?.audioDeviceId || 'default';
  const audioDeviceLabel = value?.audioDeviceLabel?.trim() || undefined;
  const audioDeviceGroupId = value?.audioDeviceGroupId?.trim() || undefined;

  if (audioDeviceId === 'default') {
    return {
      audioDeviceId: 'default',
    };
  }

  return {
    audioDeviceId,
    audioDeviceLabel,
    audioDeviceGroupId,
  };
}

export function readStoredVoicePreferences(): StoredVoicePreferences {
  if (typeof window === 'undefined') {
    return {
      audioDeviceId: 'default',
    };
  }

  try {
    const raw = window.localStorage.getItem(VOICE_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {
        audioDeviceId: 'default',
      };
    }

    return sanitizeStoredVoicePreferences(JSON.parse(raw) as StoredVoicePreferences);
  } catch {
    return {
      audioDeviceId: 'default',
    };
  }
}

export function writeStoredVoicePreferences(next: StoredVoicePreferences) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const current = readStoredVoicePreferences();
    const merged = sanitizeStoredVoicePreferences({
      ...current,
      ...next,
    });
    window.localStorage.setItem(VOICE_PREFERENCES_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Persistence issues should never break live calls.
  }
}

export function useStoredVoicePreferences() {
  const [storedPreferences, setStoredPreferences] = useState<StoredVoicePreferences>({
    audioDeviceId: 'default',
  });

  useEffect(() => {
    const nextPreferences = readStoredVoicePreferences();
    setStoredPreferences((current) =>
      areStoredVoicePreferencesEqual(current, nextPreferences) ? current : nextPreferences
    );
  }, []);

  const writePreference = useCallback((next: StoredVoicePreferences) => {
    setStoredPreferences((current) => {
      const merged = sanitizeStoredVoicePreferences({
        ...current,
        ...next,
      });

      if (areStoredVoicePreferencesEqual(current, merged)) {
        return current;
      }

      writeStoredVoicePreferences(merged);
      return merged;
    });
  }, []);

  const storeAudioDeviceId = useCallback(
    (audioDeviceId: string) => {
      writePreference({
        audioDeviceId,
      });
    },
    [writePreference]
  );

  const storeAudioDevicePreference = useCallback(
    (input: {
      audioDeviceId: string;
      audioDeviceLabel?: string | null;
      audioDeviceGroupId?: string | null;
    }) => {
      writePreference({
        audioDeviceId: input.audioDeviceId,
        audioDeviceLabel: input.audioDeviceLabel?.trim() || undefined,
        audioDeviceGroupId: input.audioDeviceGroupId?.trim() || undefined,
      });
    },
    [writePreference]
  );

  return {
    storedAudioDeviceId: storedPreferences.audioDeviceId || 'default',
    storedAudioDeviceLabel: storedPreferences.audioDeviceLabel || null,
    storedAudioDeviceGroupId: storedPreferences.audioDeviceGroupId || null,
    storeAudioDevicePreference,
    storeAudioDeviceId,
  };
}
