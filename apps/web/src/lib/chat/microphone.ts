import { chatClientDebug, chatClientError } from '@/lib/chat/debug';

export const DEFAULT_MIC_CAPTURE_OPTIONS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;

const MICROPHONE_ATTEMPT_TIMEOUT_MS = 2_500;
const INTERACTIVE_MICROPHONE_PROMPT_TIMEOUT_MS = 20_000;
const DEFAULT_DEVICE_RESOLUTION_TIMEOUT_MS = 750;
const MICROPHONE_DEVICE_ENUMERATION_TIMEOUT_MS = 2_000;
export const EXTENDED_CHROMIUM_MICROPHONE_PROMPT_TIMEOUT_MS = 300_000;

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
export type MicrophoneDeviceOption = Pick<
  MediaDeviceInfo,
  'deviceId' | 'groupId' | 'kind' | 'label' | 'toJSON'
>;

type RequestRawMicrophoneStreamOptions = {
  interactive?: boolean;
  timeoutMs?: number | null;
  preferredDeviceLabel?: string | null;
  preferredDeviceGroupId?: string | null;
  userAgent?: string | null;
};

function stopMediaStream(stream?: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

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

export function shouldForceDefaultMicrophoneForLiveJoin(
  userAgent?: string | null,
  permissionState: MicrophonePermissionState = 'unknown'
) {
  return (
    shouldPreferDefaultMicrophoneForLiveJoin(userAgent) && permissionState !== 'granted'
  );
}

export function isPendingMicrophonePermissionState(
  userAgent?: string | null,
  permissionState: MicrophonePermissionState = 'unknown'
) {
  if (permissionState === 'prompt') {
    return true;
  }

  return detectMicrophoneBrowserFamily(userAgent) === 'safari' && permissionState === 'unknown';
}

function filterSupportedAudioConstraints(
  constraints: MediaTrackConstraints
): MediaTrackConstraints {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getSupportedConstraints) {
    return constraints;
  }

  const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
  const hasSupportMetadata = Object.keys(supportedConstraints).length > 0;
  const filteredConstraints: MediaTrackConstraints = {};

  if (constraints.deviceId !== undefined) {
    if (!hasSupportMetadata || supportedConstraints.deviceId) {
      filteredConstraints.deviceId = constraints.deviceId;
    }
  }

  if (constraints.echoCancellation !== undefined) {
    if (!hasSupportMetadata || supportedConstraints.echoCancellation) {
      filteredConstraints.echoCancellation = constraints.echoCancellation;
    }
  }

  if (constraints.noiseSuppression !== undefined) {
    if (!hasSupportMetadata || supportedConstraints.noiseSuppression) {
      filteredConstraints.noiseSuppression = constraints.noiseSuppression;
    }
  }

  if (constraints.autoGainControl !== undefined) {
    if (!hasSupportMetadata || supportedConstraints.autoGainControl) {
      filteredConstraints.autoGainControl = constraints.autoGainControl;
    }
  }

  return Object.keys(filteredConstraints).length > 0 ? filteredConstraints : constraints;
}

export function buildMicrophoneCaptureOptions(audioDeviceId?: string | null) {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  return filterSupportedAudioConstraints({
    ...DEFAULT_MIC_CAPTURE_OPTIONS,
    deviceId: normalizedDeviceId !== 'default' ? { exact: normalizedDeviceId } : undefined,
  });
}

export function buildRawMicrophoneConstraints(audioDeviceId?: string | null): MediaTrackConstraints {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  return filterSupportedAudioConstraints({
    ...DEFAULT_MIC_CAPTURE_OPTIONS,
    ...(normalizedDeviceId !== 'default' ? { deviceId: { exact: normalizedDeviceId } } : {}),
  });
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
      return 'Look for the microphone prompt in the address bar and choose Allow this time or Allow on every visit. If it was dismissed, open Chrome site settings for this site and allow the microphone.';
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

export function formatMicrophonePermissionStateLabel(state: MicrophonePermissionState) {
  switch (state) {
    case 'granted':
      return 'Allowed';
    case 'denied':
      return 'Blocked';
    case 'prompt':
      return 'Waiting for browser decision';
    default:
      return 'Browser-managed';
  }
}

export function areMicrophoneDeviceLabelsVisible(
  devices: Array<Pick<MicrophoneDeviceOption, 'label'>>
) {
  return devices.some((device) => device.label.trim().length > 0);
}

export function getMicrophonePermissionHelpMessage(
  state: MicrophonePermissionState,
  options?: {
    userAgent?: string | null;
    hasDetectedDevices?: boolean;
    labelsVisible?: boolean;
  }
) {
  const userAgent = options?.userAgent ?? getCurrentBrowserUserAgent();
  const recoveryHint = getMicrophonePermissionRecoveryHint(userAgent);
  const labelsHiddenNote =
    options?.hasDetectedDevices && !options?.labelsVisible
      ? ' Device names stay hidden until the browser grants microphone access.'
      : '';

  switch (state) {
    case 'granted':
      return options?.hasDetectedDevices
        ? options?.labelsVisible
          ? 'Microphone access is already allowed. You can switch between available microphones here.'
          : 'Microphone access is allowed, but this browser has not exposed device names yet. Use Refresh devices after returning from browser settings.'
        : 'Microphone access is allowed, but no audio input devices are currently visible to the browser.';
    case 'denied':
      return `Microphone access is blocked for this site. ${recoveryHint}`;
    case 'prompt':
      return `This browser is still waiting for a microphone decision. ${recoveryHint}${labelsHiddenNote}`;
    default:
      return `This browser does not expose a reliable microphone permission state before access. ${recoveryHint}${labelsHiddenNote}`;
  }
}

export async function listAudioInputDevices(options?: {
  silent?: boolean;
  timeoutMs?: number;
}): Promise<MicrophoneDeviceOption[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }

  const timeoutMs = options?.timeoutMs ?? MICROPHONE_DEVICE_ENUMERATION_TIMEOUT_MS;

  try {
    const devices = await Promise.race([
      navigator.mediaDevices.enumerateDevices(),
      new Promise<MediaDeviceInfo[]>((_, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(
              `Timed out while listing audio input devices after ${timeoutMs}ms.`
            )
          );
        }, timeoutMs);
      }),
    ]);
    const audioInputs = devices.filter(
      (device): device is MicrophoneDeviceOption => device.kind === 'audioinput'
    );

    if (!options?.silent) {
      chatClientDebug('microphone.devices.list', {
        count: audioInputs.length,
        labelsVisible: areMicrophoneDeviceLabelsVisible(audioInputs),
        deviceIds: audioInputs.map((device) => device.deviceId),
      });
    }

    return audioInputs;
  } catch (error) {
    if (!options?.silent) {
      chatClientError('microphone.devices.error', {
        timeoutMs,
        error:
          error instanceof Error
            ? error
            : new Error('Failed to enumerate microphone devices.'),
      });
    }
    throw error;
  }
}

function trimMicrophonePreferenceValue(value?: string | null) {
  const normalizedValue = value?.trim() || '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function resolvePreferredAudioInputDevice(
  devices: MicrophoneDeviceOption[],
  preference: {
    audioDeviceId?: string | null;
    audioDeviceLabel?: string | null;
    audioDeviceGroupId?: string | null;
  }
) {
  const normalizedDeviceId = normalizeAudioInputDeviceId(preference.audioDeviceId);
  const normalizedLabel = trimMicrophonePreferenceValue(preference.audioDeviceLabel);
  const normalizedGroupId = trimMicrophonePreferenceValue(preference.audioDeviceGroupId);

  if (normalizedDeviceId === 'default') {
    return null;
  }

  return (
    devices.find((device) => device.deviceId === normalizedDeviceId) ??
    (normalizedGroupId
      ? devices.find((device) => trimMicrophonePreferenceValue(device.groupId) === normalizedGroupId)
      : null) ??
    (normalizedLabel
      ? devices.find((device) => trimMicrophonePreferenceValue(device.label) === normalizedLabel)
      : null) ??
    null
  );
}

async function resolveRequestedAudioInputDeviceId(
  audioDeviceId?: string | null,
  options?: {
    preferredDeviceLabel?: string | null;
    preferredDeviceGroupId?: string | null;
    timeoutMs?: number;
  }
) {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  if (normalizedDeviceId === 'default') {
    return 'default';
  }

  const preferredDeviceLabel = trimMicrophonePreferenceValue(options?.preferredDeviceLabel);
  const preferredDeviceGroupId = trimMicrophonePreferenceValue(options?.preferredDeviceGroupId);

  if (!preferredDeviceLabel && !preferredDeviceGroupId) {
    return normalizedDeviceId;
  }

  try {
    const audioInputs = await listAudioInputDevices({
      silent: true,
      timeoutMs: options?.timeoutMs ?? DEFAULT_DEVICE_RESOLUTION_TIMEOUT_MS,
    });
    const matchedDevice = resolvePreferredAudioInputDevice(audioInputs, {
      audioDeviceId: normalizedDeviceId,
      audioDeviceLabel: preferredDeviceLabel,
      audioDeviceGroupId: preferredDeviceGroupId,
    });

    if (!matchedDevice) {
      return normalizedDeviceId;
    }

    if (matchedDevice.deviceId !== normalizedDeviceId) {
      chatClientDebug('microphone.request.selected-device.resolved', {
        requestedDeviceId: normalizedDeviceId,
        resolvedDeviceId: matchedDevice.deviceId,
        resolvedGroupId: matchedDevice.groupId,
        resolvedLabel: matchedDevice.label,
      });
    }

    return matchedDevice.deviceId;
  } catch {
    return normalizedDeviceId;
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
    const defaultGroupId = defaultDevice?.groupId?.trim() ?? '';
    const defaultLabelMatch = defaultLabel.match(/^default\s*\((.*)\)$/i);
    const preferredLabel = defaultLabelMatch?.[1]?.trim() ?? null;
    const matchedDevice =
      (defaultGroupId
        ? concreteDevices.find((device) => device.groupId.trim() === defaultGroupId)
        : null) ??
      (preferredLabel
        ? concreteDevices.find((device) => device.label.trim() === preferredLabel)
        : null) ??
      (concreteDevices.length === 1 ? concreteDevices[0] : null);

    if (!matchedDevice) {
      chatClientDebug('microphone.default-device.unresolved', {
        reason: 'ambiguous-concrete-audio-inputs',
        defaultDeviceId: defaultDevice?.deviceId ?? null,
        defaultGroupId,
        defaultLabel,
        candidates: concreteDevices.map((device) => ({
          deviceId: device.deviceId,
          groupId: device.groupId,
          label: device.label,
        })),
      });
      return null;
    }

    chatClientDebug('microphone.default-device.resolved', {
      defaultDeviceId: defaultDevice?.deviceId ?? null,
      defaultGroupId,
      defaultLabel,
      resolvedDeviceId: matchedDevice.deviceId,
      resolvedGroupId: matchedDevice.groupId,
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
    browserFamily?: MicrophoneBrowserFamily;
  }
): MicrophoneAttempt[] {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  const shouldUseSingleInteractiveAttempt =
    normalizedDeviceId === 'default' &&
    options?.interactive &&
    (options.permissionState === 'prompt' ||
      (options.browserFamily === 'safari' && options.permissionState === 'unknown')) &&
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
  timeoutMs: number | null = MICROPHONE_ATTEMPT_TIMEOUT_MS
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
    const timeout =
      typeof timeoutMs === 'number'
        ? setTimeout(() => {
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
          }, timeoutMs)
        : null;

    request.then(
      (stream) => {
        if (settled) {
          return;
        }

        settled = true;
        if (timeout) {
          clearTimeout(timeout);
        }
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
        if (timeout) {
          clearTimeout(timeout);
        }
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
  const browserFamily = detectMicrophoneBrowserFamily(options?.userAgent);
  const shouldTreatPermissionStateAsPending = isPendingMicrophonePermissionState(
    options?.userAgent,
    permissionState
  );
  const shouldSkipDefaultDeviceResolution =
    normalizedDeviceId === 'default' && options?.interactive && shouldTreatPermissionStateAsPending;
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

  const shouldUnlockPermissionBeforeExactDevice =
    options?.interactive &&
    normalizedDeviceId !== 'default' &&
    shouldTreatPermissionStateAsPending;
  const resolvedRequestedAudioDeviceId =
    normalizedDeviceId !== 'default' && !shouldUnlockPermissionBeforeExactDevice
      ? await resolveRequestedAudioInputDeviceId(normalizedDeviceId, {
          preferredDeviceLabel: options?.preferredDeviceLabel,
          preferredDeviceGroupId: options?.preferredDeviceGroupId,
        })
      : normalizedDeviceId;
  const attempts = buildRawMicrophoneAttempts(resolvedRequestedAudioDeviceId, {
    interactive: options?.interactive,
    permissionState,
    resolvedDefaultAudioDeviceId,
    browserFamily,
  });
  let lastError: unknown = null;
  const explicitTimeoutMs =
    options && Object.prototype.hasOwnProperty.call(options, 'timeoutMs')
      ? options.timeoutMs
      : undefined;
  const timeoutMs =
    explicitTimeoutMs !== undefined
      ? explicitTimeoutMs
      : options?.interactive &&
          normalizedDeviceId === 'default' &&
          shouldTreatPermissionStateAsPending &&
          !resolvedDefaultAudioDeviceId
        ? INTERACTIVE_MICROPHONE_PROMPT_TIMEOUT_MS
        : MICROPHONE_ATTEMPT_TIMEOUT_MS;

  if (shouldUnlockPermissionBeforeExactDevice) {
    chatClientDebug('microphone.request.permission-unlock.start', {
      audioDeviceId: normalizedDeviceId,
      permissionState,
      timeoutMs,
    });

    const permissionUnlockStream = await requestMicrophoneWithAttempt(
      'default',
      {
        label: 'permission-unlock-audio-true',
        constraints: true,
      },
      timeoutMs
    );

    chatClientDebug('microphone.request.permission-unlock.success', {
      audioDeviceId: normalizedDeviceId,
      permissionState,
    });

    try {
      const resolvedSelectedAudioDeviceId = await resolveRequestedAudioInputDeviceId(
        normalizedDeviceId,
        {
          preferredDeviceLabel: options?.preferredDeviceLabel,
          preferredDeviceGroupId: options?.preferredDeviceGroupId,
        }
      );
      const exactAttempts = buildRawMicrophoneAttempts(resolvedSelectedAudioDeviceId, {
        interactive: false,
        permissionState: 'granted',
        browserFamily,
      });
      let lastExactError: unknown = null;

      for (const attempt of exactAttempts) {
        try {
          const selectedStream = await requestMicrophoneWithAttempt(
            resolvedSelectedAudioDeviceId,
            attempt,
            MICROPHONE_ATTEMPT_TIMEOUT_MS
          );
          stopMediaStream(permissionUnlockStream);
          chatClientDebug('microphone.request.selected-device.success', {
            audioDeviceId: normalizedDeviceId,
            attempt: attempt.label,
          });
          return selectedStream;
        } catch (error) {
          lastExactError = error;
        }
      }

      if (isRecoverableMicrophoneDeviceError(lastExactError)) {
        chatClientDebug('microphone.request.selected-device.fallback-unlock-stream', {
          audioDeviceId: normalizedDeviceId,
          error:
            lastExactError instanceof Error
              ? lastExactError
              : new Error('Selected microphone verification failed after permission unlock.'),
        });
        return permissionUnlockStream;
      }

      stopMediaStream(permissionUnlockStream);
      throw (
        lastExactError instanceof Error
          ? lastExactError
          : new Error('Failed to access the selected microphone after permission unlock.')
      );
    } catch (error) {
      stopMediaStream(permissionUnlockStream);
      throw error;
    }
  }

  for (const attempt of attempts) {
    try {
      return await requestMicrophoneWithAttempt(
        resolvedRequestedAudioDeviceId,
        attempt,
        timeoutMs
      );
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

export async function requestMicrophonePermission(options?: {
  timeoutMs?: number | null;
}) {
  await probeMicrophoneCapture('default', {
    interactive: true,
    timeoutMs: options?.timeoutMs ?? INTERACTIVE_MICROPHONE_PROMPT_TIMEOUT_MS,
  });
}

export async function resolveJoinAudioInputDeviceId(
  audioDeviceId?: string | null,
  options?: {
    userAgent?: string | null;
    preferBrowserStability?: boolean;
    microphoneRequestOptions?: RequestRawMicrophoneStreamOptions;
    microphonePermissionState?: MicrophonePermissionState;
  }
): Promise<JoinMicrophoneResolution> {
  const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
  const preferBrowserStability = options?.preferBrowserStability !== false;
  const permissionState =
    options?.microphonePermissionState ??
    (preferBrowserStability ? await getMicrophonePermissionState({ silent: true }) : 'unknown');

  if (normalizedDeviceId === 'default') {
    return {
      audioDeviceId: 'default',
      shouldPersist: false,
      usedBrowserStabilityFallback: false,
    };
  }

  if (options?.microphoneRequestOptions?.interactive && permissionState !== 'granted') {
    return {
      audioDeviceId: normalizedDeviceId,
      shouldPersist: false,
      usedBrowserStabilityFallback: false,
    };
  }

  if (
    preferBrowserStability &&
    normalizedDeviceId !== 'default' &&
    shouldForceDefaultMicrophoneForLiveJoin(options?.userAgent, permissionState)
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
