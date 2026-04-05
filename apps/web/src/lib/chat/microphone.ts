import { chatClientDebug, chatClientError } from '@/lib/chat/debug';

export const DEFAULT_MIC_CAPTURE_OPTIONS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;

const MICROPHONE_ATTEMPT_TIMEOUT_MS = 2_500;
const INTERACTIVE_MICROPHONE_PROMPT_TIMEOUT_MS = 20_000;
const DEFAULT_DEVICE_RESOLUTION_TIMEOUT_MS = 750;

type JoinMicrophoneResolution = {
  audioDeviceId: string;
  shouldPersist: boolean;
  usedBrowserStabilityFallback: boolean;
};

export type MicrophonePermissionState = PermissionState | 'unknown';
export type MicrophoneBrowserFamily =
  | 'chromium'
  | 'edge'
  | 'firefox'
  | 'safari'
  | 'unknown';

type RequestRawMicrophoneStreamOptions = {
  interactive?: boolean;
  timeoutMs?: number;
};

export function normalizeAudioInputDeviceId(audioDeviceId?: string | null) {
  return audioDeviceId && audioDeviceId !== 'default' ? audioDeviceId : 'default';
}

export function detectMicrophoneBrowserFamily(
  userAgent?: string | null
): MicrophoneBrowserFamily {
  const agent =
    (userAgent ??
      (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
        ? navigator.userAgent
        : ''))
      .toLowerCase();

  const isFirefox = agent.includes('firefox') || agent.includes('fxios');
  if (isFirefox) {
    return 'firefox';
  }

  const isEdge = agent.includes('edg') || agent.includes('edge');
  if (isEdge) {
    return 'edge';
  }

  const isSafari =
    agent.includes('safari') &&
    !agent.includes('chrome') &&
    !agent.includes('chromium') &&
    !agent.includes('crios') &&
    !agent.includes('edg') &&
    !agent.includes('opr') &&
    !agent.includes('opera') &&
    !agent.includes('android');
  if (isSafari) {
    return 'safari';
  }

  const isChromium =
    agent.includes('chrome') || agent.includes('chromium') || agent.includes('crios');
  if (isChromium) {
    return 'chromium';
  }

  return 'unknown';
}

export function shouldPreferDefaultMicrophoneForLiveJoin(userAgent?: string | null) {
  const browserFamily = detectMicrophoneBrowserFamily(userAgent);
  return browserFamily === 'chromium' || browserFamily === 'edge' || browserFamily === 'safari';
}

export function buildMicrophoneCaptureOptions(audioDeviceId?: string | null) {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  return {
    ...DEFAULT_MIC_CAPTURE_OPTIONS,
    deviceId: normalizedDeviceId !== 'default' ? { exact: normalizedDeviceId } : undefined,
  };
}

export function buildRawMicrophoneConstraints(audioDeviceId?: string | null): MediaTrackConstraints {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  return {
    ...DEFAULT_MIC_CAPTURE_OPTIONS,
    ...(normalizedDeviceId !== 'default' ? { deviceId: { exact: normalizedDeviceId } } : {}),
  };
}

export function resolvePreferredJoinAudioInputDeviceId(
  audioDeviceId?: string | null,
  options?: {
    userAgent?: string | null;
    preferBrowserStability?: boolean;
  }
) {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  const preferBrowserStability = options?.preferBrowserStability !== false;
  const usedBrowserStabilityFallback =
    preferBrowserStability &&
    normalizedDeviceId !== 'default' &&
    shouldPreferDefaultMicrophoneForLiveJoin(options?.userAgent);

  return {
    audioDeviceId: usedBrowserStabilityFallback ? 'default' : normalizedDeviceId,
    usedBrowserStabilityFallback,
  };
}

export function isRecoverableMicrophoneDeviceError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('timed out while starting the microphone') ||
    message.includes('timed out while requesting microphone access') ||
    message.includes('microphone request attempt') ||
    message.includes('audiocontext encountered an error') ||
    message.includes('webaudio renderer') ||
    message.includes('notreadableerror') ||
    message.includes('could not start audio source') ||
    message.includes('requested device not found') ||
    message.includes('device not found') ||
    message.includes('notfounderror') ||
    message.includes('overconstrainederror')
  );
}

function getCurrentBrowserUserAgent() {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
    return '';
  }

  return navigator.userAgent;
}

function getMicrophonePermissionRecoveryHint(userAgent?: string | null) {
  switch (detectMicrophoneBrowserFamily(userAgent)) {
    case 'edge':
      return 'Look for the microphone prompt in the address bar. If it was dismissed, open Edge Site permissions for this site and allow the microphone.';
    case 'firefox':
      return 'Firefox usually shows microphone access near the left side of the address bar. If it disappeared, open the padlock or Page Info permissions and allow the microphone for this site.';
    case 'safari':
      return 'Safari may keep microphone access under Safari > Settings > Websites > Microphone, or in the website controls in the address bar.';
    case 'chromium':
      return 'Look for the microphone prompt in the address bar. If it was dismissed, open Chrome site settings for this site and allow the microphone.';
    default:
      return 'Check the browser microphone prompt or this site\'s permissions and allow microphone access.';
  }
}

export function getPendingMicrophoneJoinMessage(userAgent?: string | null) {
  return `Joined muted while the browser finishes microphone access. ${getMicrophonePermissionRecoveryHint(
    userAgent
  )} TaskNebula will turn your mic on automatically if access succeeds.`;
}

export function getPendingMicrophoneRuntimeMessage(userAgent?: string | null) {
  return `Browser is still waiting for microphone access. ${getMicrophonePermissionRecoveryHint(
    userAgent
  )} TaskNebula will unmute automatically if access succeeds.`;
}

export function getTimedOutMicrophoneAccessMessage(userAgent?: string | null) {
  return `Microphone access timed out while waiting for the browser prompt. ${getMicrophonePermissionRecoveryHint(
    userAgent
  )} Then try the mic button again.`;
}

export function getTimedOutPendingMicrophonePromptMessage(userAgent?: string | null) {
  return `Microphone access timed out while waiting for the browser prompt. ${getMicrophonePermissionRecoveryHint(
    userAgent
  )} If you approve it now, TaskNebula will still turn your mic on automatically. If no prompt appears, refresh this page or try the mic button again.`;
}

export function getDeniedMicrophoneAccessMessage(userAgent?: string | null) {
  return `Microphone permission was denied. ${getMicrophonePermissionRecoveryHint(userAgent)}`;
}

export function isMicrophoneAccessTimeoutError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes('timed out');
}

export async function getMicrophonePermissionState(options?: {
  silent?: boolean;
}): Promise<MicrophonePermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    if (!options?.silent) {
      chatClientDebug('microphone.permission.state', {
        state: 'unknown',
        reason: 'permissions-api-unavailable',
      });
    }
    return 'unknown';
  }

  try {
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    if (!options?.silent) {
      chatClientDebug('microphone.permission.state', {
        state: status.state,
      });
    }
    return status.state;
  } catch (error) {
    if (!options?.silent) {
      chatClientDebug('microphone.permission.state', {
        state: 'unknown',
        reason: 'permissions-query-failed',
        error: error instanceof Error ? error : new Error('Failed to query microphone permission state.'),
      });
    }
    return 'unknown';
  }
}

export function formatMicrophoneError(
  error: unknown,
  options?: {
    userAgent?: string | null;
  }
) {
  const userAgent = options?.userAgent ?? getCurrentBrowserUserAgent();

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('permission denied') || message.includes('notallowederror')) {
      return getDeniedMicrophoneAccessMessage(userAgent);
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
    if (
      message.includes('timed out while waiting for microphone access') ||
      message.includes('timed out while requesting microphone access') ||
      message.includes('microphone request attempt') ||
      message.includes('timed out while starting the microphone')
    ) {
      return getTimedOutMicrophoneAccessMessage(userAgent);
    }
    return error.message;
  }

  return `Microphone access is unavailable. ${getMicrophonePermissionRecoveryHint(userAgent)}`;
}

type MicrophoneAttempt = {
  label: string;
  constraints: boolean | MediaTrackConstraints;
};

async function resolveConcreteDefaultAudioInputDeviceId(
  timeoutMs = DEFAULT_DEVICE_RESOLUTION_TIMEOUT_MS
) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return null;
  }

  try {
    chatClientDebug('microphone.default-device.resolve.start', {
      timeoutMs,
    });

    const devices = await Promise.race([
      navigator.mediaDevices.enumerateDevices(),
      new Promise<MediaDeviceInfo[]>((_, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(
              `Timed out while resolving the default microphone device after ${timeoutMs}ms.`
            )
          );
        }, timeoutMs);
      }),
    ]);
    const audioInputs = devices.filter((device) => device.kind === 'audioinput');

    if (audioInputs.length === 0) {
      chatClientDebug('microphone.default-device.unresolved', {
        reason: 'no-audio-inputs',
      });
      return null;
    }

    const defaultDevice =
      audioInputs.find((device) => device.deviceId === 'default') ?? audioInputs[0] ?? null;
    const concreteDevices = audioInputs.filter((device) => device.deviceId !== 'default');

    if (concreteDevices.length === 0) {
      chatClientDebug('microphone.default-device.unresolved', {
        reason: 'no-concrete-audio-inputs',
      });
      return null;
    }

    const defaultLabel = defaultDevice?.label?.trim() ?? '';
    const defaultLabelMatch = defaultLabel.match(/^default\s*\((.*)\)$/i);
    const preferredLabel = defaultLabelMatch?.[1]?.trim() ?? null;
    const matchedDevice =
      (preferredLabel
        ? concreteDevices.find((device) => device.label.trim() === preferredLabel)
        : null) ??
      (concreteDevices.length === 1 ? concreteDevices[0] : null);

    if (!matchedDevice) {
      chatClientDebug('microphone.default-device.unresolved', {
        reason: 'ambiguous-concrete-audio-inputs',
        defaultDeviceId: defaultDevice?.deviceId ?? null,
        defaultLabel,
        candidates: concreteDevices.map((device) => ({
          deviceId: device.deviceId,
          label: device.label,
        })),
      });
      return null;
    }

    chatClientDebug('microphone.default-device.resolved', {
      defaultDeviceId: defaultDevice?.deviceId ?? null,
      defaultLabel,
      resolvedDeviceId: matchedDevice.deviceId,
      resolvedLabel: matchedDevice.label,
    });

    return matchedDevice.deviceId;
  } catch (error) {
    chatClientDebug('microphone.default-device.unresolved', {
      reason:
        error instanceof Error && error.message.toLowerCase().includes('timed out')
          ? 'enumerate-devices-timeout'
          : 'enumerate-devices-failed',
      error: error instanceof Error ? error : new Error('Failed to resolve the default microphone device.'),
    });
    return null;
  }
}

function buildRawMicrophoneAttempts(
  audioDeviceId?: string | null,
  options?: {
    interactive?: boolean;
    permissionState?: MicrophonePermissionState;
    resolvedDefaultAudioDeviceId?: string | null;
  }
): MicrophoneAttempt[] {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  const shouldUseSingleInteractiveAttempt =
    normalizedDeviceId === 'default' &&
    options?.interactive &&
    (options.permissionState === 'prompt' || options.permissionState === 'unknown') &&
    !options?.resolvedDefaultAudioDeviceId;

  if (normalizedDeviceId === 'default') {
    const resolvedDefaultAttempts = options?.resolvedDefaultAudioDeviceId
      ? [
          {
            label: 'default-resolved-raw-minimal',
            constraints: {
              deviceId: { exact: options.resolvedDefaultAudioDeviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          },
          {
            label: 'default-resolved-processed',
            constraints: buildRawMicrophoneConstraints(options.resolvedDefaultAudioDeviceId),
          },
        ]
      : [];

    if (resolvedDefaultAttempts.length > 0) {
      return resolvedDefaultAttempts;
    }

    if (shouldUseSingleInteractiveAttempt) {
      return [
        {
          label: 'default-audio-true',
          constraints: true,
        },
      ];
    }

    return [
      ...resolvedDefaultAttempts,
      {
        label: 'default-audio-true',
        constraints: true,
      },
      {
        label: 'default-raw-minimal',
        constraints: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      },
      {
        label: 'default-processed',
        constraints: buildRawMicrophoneConstraints('default'),
      },
    ];
  }

  return [
    {
      label: 'device-exact-processed',
      constraints: buildRawMicrophoneConstraints(normalizedDeviceId),
    },
  ];
}

async function requestMicrophoneWithAttempt(
  audioDeviceId: string,
  attempt: MicrophoneAttempt,
  timeoutMs = MICROPHONE_ATTEMPT_TIMEOUT_MS
) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support microphone capture.');
  }

  chatClientDebug('microphone.request.attempt.start', {
    audioDeviceId,
    attempt: attempt.label,
    constraints: attempt.constraints,
    timeoutMs,
  });

  let settled = false;
  const request = navigator.mediaDevices.getUserMedia({
    audio: attempt.constraints,
  });

  request.then(
    (stream) => {
      if (settled) {
        stream.getTracks().forEach((track) => track.stop());
      }
    },
    () => {
      // Ignore late failures after timeout.
    }
  );

  return await new Promise<MediaStream>((resolve, reject) => {
    const timeout = setTimeout(() => {
      settled = true;
      const error = new Error(
        `Microphone request attempt "${attempt.label}" timed out after ${timeoutMs}ms.`
      );
      chatClientError('microphone.request.attempt.timeout', {
        audioDeviceId,
        attempt: attempt.label,
        timeoutMs,
        error,
      });
      reject(error);
    }, timeoutMs);

    request.then(
      (stream) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        chatClientDebug('microphone.request.attempt.success', {
          audioDeviceId,
          attempt: attempt.label,
        });
        resolve(stream);
      },
      (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        chatClientError('microphone.request.attempt.error', {
          audioDeviceId,
          attempt: attempt.label,
          error: error instanceof Error ? error : new Error('Failed to access microphone.'),
        });
        reject(error);
      }
    );
  });
}

export async function requestRawMicrophoneStream(
  audioDeviceId?: string | null,
  options?: RequestRawMicrophoneStreamOptions
) {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  const permissionState = options?.interactive ? await getMicrophonePermissionState() : 'unknown';
  const shouldSkipDefaultDeviceResolution =
    normalizedDeviceId === 'default' && options?.interactive && permissionState === 'prompt';
  const resolvedDefaultAudioDeviceId =
    normalizedDeviceId === 'default'
      ? shouldSkipDefaultDeviceResolution
        ? (chatClientDebug('microphone.default-device.skip', {
            reason: 'permission-prompt-pending',
          }),
          null)
        : await resolveConcreteDefaultAudioInputDeviceId()
      : null;

  if (options?.interactive && permissionState === 'denied') {
    throw new Error('Microphone permission was denied. Allow microphone access in your browser and try again.');
  }

  const attempts = buildRawMicrophoneAttempts(normalizedDeviceId, {
    interactive: options?.interactive,
    permissionState,
    resolvedDefaultAudioDeviceId,
  });
  let lastError: unknown = null;
  const timeoutMs =
    options?.timeoutMs ??
    (options?.interactive &&
    normalizedDeviceId === 'default' &&
    (permissionState === 'prompt' || permissionState === 'unknown') &&
    !resolvedDefaultAudioDeviceId
      ? INTERACTIVE_MICROPHONE_PROMPT_TIMEOUT_MS
      : MICROPHONE_ATTEMPT_TIMEOUT_MS);

  for (const attempt of attempts) {
    try {
      return await requestMicrophoneWithAttempt(normalizedDeviceId, attempt, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }

  if (options?.interactive && isMicrophoneAccessTimeoutError(lastError)) {
    throw new Error(getTimedOutMicrophoneAccessMessage());
  }

  throw (
    lastError instanceof Error
      ? lastError
      : new Error('Failed to access the microphone.')
  );
}

export async function probeMicrophoneCapture(
  audioDeviceId?: string | null,
  options?: RequestRawMicrophoneStreamOptions
) {
  const stream = await requestRawMicrophoneStream(audioDeviceId, options);
  stream.getTracks().forEach((track) => track.stop());
}

export async function resolveJoinAudioInputDeviceId(
  audioDeviceId?: string | null,
  options?: {
    userAgent?: string | null;
    preferBrowserStability?: boolean;
    microphoneRequestOptions?: RequestRawMicrophoneStreamOptions;
  }
): Promise<JoinMicrophoneResolution> {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  const preferBrowserStability = options?.preferBrowserStability !== false;

  if (normalizedDeviceId === 'default') {
    return {
      audioDeviceId: 'default',
      shouldPersist: false,
      usedBrowserStabilityFallback: false,
    };
  }

  if (
    preferBrowserStability &&
    normalizedDeviceId !== 'default' &&
    shouldPreferDefaultMicrophoneForLiveJoin(options?.userAgent)
  ) {
    return {
      audioDeviceId: 'default',
      shouldPersist: false,
      usedBrowserStabilityFallback: true,
    };
  }

  try {
    await probeMicrophoneCapture(normalizedDeviceId, options?.microphoneRequestOptions);
    return {
      audioDeviceId: normalizedDeviceId,
      shouldPersist: false,
      usedBrowserStabilityFallback: false,
    };
  } catch (error) {
    if (normalizedDeviceId !== 'default' && isRecoverableMicrophoneDeviceError(error)) {
      return {
        audioDeviceId: 'default',
        shouldPersist: true,
        usedBrowserStabilityFallback: false,
      };
    }
    throw error;
  }
}
