import {
  formatMicrophonePermissionStateLabel,
  getMicrophonePermissionHelpMessage,
  getPendingMicrophoneJoinMessage,
  getTimedOutMicrophoneAccessMessage,
  requestRawMicrophoneStream,
  resolveJoinAudioInputDeviceId,
  type MicrophoneMessageCatalog,
} from '@/lib/chat/microphone';

const microphoneMessages: MicrophoneMessageCatalog = {
  recoveryHint: {
    chromium:
      'Look for the microphone prompt in the address bar and choose Allow this time or Allow on every visit. If it was dismissed, open Chrome site settings for this site and allow the microphone.',
    edge: 'Look for the microphone prompt in the address bar. If it was dismissed, open Edge Site permissions for this site and allow the microphone.',
    firefox:
      'Firefox usually shows microphone access near the left side of the address bar. If it disappeared, open the padlock or Page Info permissions and allow the microphone for this site.',
    safari:
      'Safari may keep microphone access under Safari > Settings > Websites > Microphone, or in the website controls in the address bar.',
    unknown:
      "Check the browser microphone prompt or this site's permissions and allow microphone access.",
  },
  pendingJoin: ({ hint }) =>
    `Joined muted while the browser finishes microphone access. ${hint} TaskNebula will turn your mic on automatically if access succeeds.`,
  pendingRuntime: ({ hint }) =>
    `Browser is still waiting for microphone access. ${hint} TaskNebula will unmute automatically if access succeeds.`,
  timedOutAccess: ({ hint }) =>
    `Microphone access timed out while waiting for the browser prompt. ${hint} Then try the mic button again.`,
  timedOutPendingPrompt: ({ hint }) =>
    `Microphone access timed out while waiting for the browser prompt. ${hint} If you approve it now, TaskNebula will still turn your mic on automatically. If no prompt appears, refresh this page or try the mic button again.`,
  deniedAccess: ({ hint }) => `Microphone permission was denied. ${hint}`,
  captureUnsupported: 'This browser does not support microphone capture.',
  audioEngineFailed:
    'The browser audio engine failed for this device. Stop other audio apps or change your microphone, then try again.',
  microphoneNotFound: 'No microphone was found. Check your audio input device and try again.',
  microphoneBusy: 'Your microphone is busy in another app. Close other audio apps and try again.',
  accessUnavailable: ({ hint }) => `Microphone access is unavailable. ${hint}`,
  permissionState: {
    allowed: 'Allowed',
    blocked: 'Blocked',
    waitingForBrowserDecision: 'Waiting for browser decision',
    browserManaged: 'Browser-managed',
  },
  permissionHelp: {
    deviceLabelsHiddenUntilPermission:
      'Device names stay hidden until the browser grants microphone access.',
    grantedWithDevicesAndLabels:
      'Microphone access is already allowed. You can switch between available microphones here.',
    grantedLabelsHidden:
      'Microphone access is allowed, but this browser has not exposed device names yet. Use Refresh devices after returning from browser settings.',
    grantedNoDevices:
      'Microphone access is allowed, but no audio input devices are currently visible to the browser.',
    denied: ({ hint }) => `Microphone access is blocked for this site. ${hint}`,
    prompt: ({ hint, labelsHiddenNote }) =>
      `This browser is still waiting for a microphone decision. ${hint}${
        labelsHiddenNote ? ` ${labelsHiddenNote}` : ''
      }`,
    unknown: ({ hint, labelsHiddenNote }) =>
      `This browser does not expose a reliable microphone permission state before access. ${hint}${
        labelsHiddenNote ? ` ${labelsHiddenNote}` : ''
      }`,
  },
};

describe('chat microphone helpers', () => {
  beforeEach(() => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: jest.fn().mockResolvedValue([]),
        getUserMedia: jest.fn(),
        getSupportedConstraints: jest.fn().mockReturnValue({
          deviceId: true,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }),
      },
    });
    Object.defineProperty(global.navigator, 'permissions', {
      configurable: true,
      value: {
        query: jest.fn().mockResolvedValue({ state: 'granted' }),
      },
    });
  });

  it('keeps the selected device when microphone probing succeeds', async () => {
    global.navigator.mediaDevices.getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }],
    });

    await expect(resolveJoinAudioInputDeviceId('mic-usb')).resolves.toEqual({
      audioDeviceId: 'mic-usb',
      shouldPersist: false,
      usedBrowserStabilityFallback: false,
    });

    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: 'mic-usb' },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  it('falls back to the default microphone when a selected device fails to start', async () => {
    global.navigator.mediaDevices.getUserMedia
      .mockRejectedValueOnce(
        new Error(
          'The AudioContext encountered an error from the audio device or the WebAudio renderer.'
        )
      )
      .mockResolvedValueOnce({
        getTracks: () => [{ stop: jest.fn() }],
      });

    await expect(resolveJoinAudioInputDeviceId('mic-usb')).resolves.toEqual({
      audioDeviceId: 'default',
      shouldPersist: true,
      usedBrowserStabilityFallback: false,
    });

    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: {
        deviceId: { exact: 'mic-usb' },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('does not hide microphone permission errors behind a fallback retry', async () => {
    global.navigator.mediaDevices.getUserMedia.mockRejectedValue(
      new Error('NotAllowedError: Permission denied')
    );

    await expect(resolveJoinAudioInputDeviceId('mic-usb')).rejects.toThrow('NotAllowedError');
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('filters capture constraints down to the browser-supported set', async () => {
    global.navigator.mediaDevices.getSupportedConstraints.mockReturnValue({
      deviceId: true,
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: false,
    });
    global.navigator.mediaDevices.getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }],
    });

    await expect(resolveJoinAudioInputDeviceId('mic-usb')).resolves.toEqual({
      audioDeviceId: 'mic-usb',
      shouldPersist: false,
      usedBrowserStabilityFallback: false,
    });

    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: 'mic-usb' },
        echoCancellation: true,
      },
    });
  });

  it('preserves the selected microphone on Chromium while permission is still pending', async () => {
    global.navigator.permissions.query.mockResolvedValue({ state: 'prompt' });

    await expect(
      resolveJoinAudioInputDeviceId('mic-usb', {
        preferBrowserStability: true,
        microphoneRequestOptions: {
          interactive: true,
        },
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      })
    ).resolves.toEqual({
      audioDeviceId: 'mic-usb',
      shouldPersist: false,
      usedBrowserStabilityFallback: false,
    });

    expect(global.navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('keeps the selected microphone on Chromium once microphone access is already granted', async () => {
    global.navigator.permissions.query.mockResolvedValue({ state: 'granted' });
    global.navigator.mediaDevices.getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }],
    });

    await expect(
      resolveJoinAudioInputDeviceId('mic-usb', {
        preferBrowserStability: true,
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      })
    ).resolves.toEqual({
      audioDeviceId: 'mic-usb',
      shouldPersist: false,
      usedBrowserStabilityFallback: false,
    });

    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: 'mic-usb' },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  it('does not probe the default microphone before joining', async () => {
    await expect(resolveJoinAudioInputDeviceId('default')).resolves.toEqual({
      audioDeviceId: 'default',
      shouldPersist: false,
      usedBrowserStabilityFallback: false,
    });

    expect(global.navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('retries the default microphone with a lighter constraint set when the first attempt hangs', async () => {
    jest.useFakeTimers();

    const lateTracks = [{ stop: jest.fn() }];
    const fallbackTracks = [{ stop: jest.fn() }];
    const lateStream = {
      getAudioTracks: () => lateTracks,
      getTracks: () => lateTracks,
    };
    const fallbackStream = {
      getAudioTracks: () => fallbackTracks,
      getTracks: () => fallbackTracks,
    };

    let resolveLateRequest: ((stream: typeof lateStream) => void) | null = null;
    global.navigator.mediaDevices.getUserMedia
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLateRequest = resolve;
          })
      )
      .mockResolvedValueOnce(fallbackStream);

    const requestPromise = requestRawMicrophoneStream('default');

    await jest.advanceTimersByTimeAsync(2_500);
    await Promise.resolve();

    await expect(requestPromise).resolves.toBe(fallbackStream);

    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: true,
    });
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    resolveLateRequest?.(lateStream);
    await Promise.resolve();
    expect(lateTracks[0]?.stop).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('falls back to the resolved concrete microphone after a generic default request hangs', async () => {
    jest.useFakeTimers();

    global.navigator.mediaDevices.enumerateDevices.mockResolvedValue([
      {
        deviceId: 'default',
        kind: 'audioinput',
        label: 'default (Arctis 7P+ Mono)',
      },
      {
        deviceId: 'usb-arctis',
        kind: 'audioinput',
        label: 'Arctis 7P+ Mono',
      },
    ]);

    const lateTracks = [{ stop: jest.fn() }];
    const lateStream = {
      getAudioTracks: () => lateTracks,
      getTracks: () => lateTracks,
    };
    const concreteTracks = [{ stop: jest.fn() }];
    const concreteStream = {
      getAudioTracks: () => concreteTracks,
      getTracks: () => concreteTracks,
    };

    let resolveDefaultRequest: ((stream: typeof concreteStream) => void) | null = null;
    global.navigator.mediaDevices.getUserMedia
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveDefaultRequest = resolve;
          })
      )
      .mockResolvedValueOnce(concreteStream);

    const requestPromise = requestRawMicrophoneStream('default');

    await jest.advanceTimersByTimeAsync(2_500);
    await Promise.resolve();

    await expect(requestPromise).resolves.toBe(concreteStream);
    expect(global.navigator.mediaDevices.enumerateDevices).toHaveBeenCalledTimes(1);
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: true,
    });
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: {
        deviceId: { exact: 'usb-arctis' },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    resolveDefaultRequest?.(lateStream);
    await Promise.resolve();
    expect(lateTracks[0]?.stop).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('uses a single longer interactive attempt while the browser permission prompt is pending', async () => {
    jest.useFakeTimers();

    global.navigator.permissions.query.mockResolvedValue({ state: 'prompt' });
    global.navigator.mediaDevices.getUserMedia.mockImplementation(
      () => new Promise(() => undefined)
    );

    const requestPromise = requestRawMicrophoneStream('default', {
      interactive: true,
      timeoutMs: 5_000,
    });

    await jest.advanceTimersByTimeAsync(19_999);
    await Promise.resolve();
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

    const rejection = expect(requestPromise).rejects.toThrow('MICROPHONE_ACCESS_TIMEOUT');
    await jest.advanceTimersByTimeAsync(1);
    await rejection;
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
    });
    expect(global.navigator.mediaDevices.enumerateDevices).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('unlocks microphone permission before switching back to the selected device', async () => {
    const unlockTracks = [{ stop: jest.fn() }];
    const selectedTracks = [{ stop: jest.fn() }];
    const unlockStream = {
      getAudioTracks: () => unlockTracks,
      getTracks: () => unlockTracks,
    };
    const selectedStream = {
      getAudioTracks: () => selectedTracks,
      getTracks: () => selectedTracks,
    };

    global.navigator.permissions.query.mockResolvedValue({ state: 'prompt' });
    global.navigator.mediaDevices.getUserMedia
      .mockResolvedValueOnce(unlockStream)
      .mockResolvedValueOnce(selectedStream);

    await expect(
      requestRawMicrophoneStream('mic-usb', {
        interactive: true,
        timeoutMs: 5_000,
      })
    ).resolves.toBe(selectedStream);

    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: true,
    });
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: {
        deviceId: { exact: 'mic-usb' },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    expect(unlockTracks[0]?.stop).toHaveBeenCalledTimes(1);
  });

  it('does not let a stalled default-device lookup block microphone capture', async () => {
    jest.useFakeTimers();

    global.navigator.permissions.query.mockResolvedValue({ state: 'granted' });
    global.navigator.mediaDevices.enumerateDevices.mockImplementation(
      () => new Promise(() => undefined)
    );

    const tracks = [{ stop: jest.fn() }];
    const stream = {
      getAudioTracks: () => tracks,
      getTracks: () => tracks,
    };

    global.navigator.mediaDevices.getUserMedia.mockResolvedValue(stream);

    const requestPromise = requestRawMicrophoneStream('default');

    await jest.advanceTimersByTimeAsync(750);
    await Promise.resolve();

    await expect(requestPromise).resolves.toBe(stream);
    expect(global.navigator.mediaDevices.enumerateDevices).toHaveBeenCalledTimes(1);
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
    });

    jest.useRealTimers();
  });

  it('fails fast when microphone permission is already denied', async () => {
    global.navigator.permissions.query.mockResolvedValue({ state: 'denied' });

    await expect(
      requestRawMicrophoneStream('default', {
        interactive: true,
      })
    ).rejects.toThrow('MICROPHONE_PERMISSION_DENIED');

    expect(global.navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('still prefers a browser-native default microphone request when the permissions API cannot report state', async () => {
    global.navigator.permissions.query.mockRejectedValue(new Error('permissions query failed'));
    global.navigator.mediaDevices.enumerateDevices.mockResolvedValue([
      {
        deviceId: 'default',
        kind: 'audioinput',
        label: 'default (Arctis 7P+ Mono)',
      },
      {
        deviceId: 'usb-arctis',
        kind: 'audioinput',
        label: 'Arctis 7P+ Mono',
      },
    ]);

    const concreteTracks = [{ stop: jest.fn() }];
    const concreteStream = {
      getAudioTracks: () => concreteTracks,
      getTracks: () => concreteTracks,
    };

    global.navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(concreteStream);

    await expect(
      requestRawMicrophoneStream('default', {
        interactive: true,
        timeoutMs: 5_000,
      })
    ).resolves.toBe(concreteStream);

    expect(global.navigator.permissions.query).toHaveBeenCalledWith({
      name: 'microphone',
    });
    expect(global.navigator.mediaDevices.enumerateDevices).toHaveBeenCalledTimes(1);
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: true,
    });
  });

  it('treats Safari unknown microphone permission as a pending prompt and skips device resolution', async () => {
    jest.useFakeTimers();

    global.navigator.permissions.query.mockRejectedValue(new Error('permissions query failed'));
    global.navigator.mediaDevices.getUserMedia.mockImplementation(
      () => new Promise(() => undefined)
    );

    const requestPromise = requestRawMicrophoneStream('default', {
      interactive: true,
      timeoutMs: 5_000,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    });

    await jest.advanceTimersByTimeAsync(4_999);
    await Promise.resolve();

    expect(global.navigator.mediaDevices.enumerateDevices).not.toHaveBeenCalled();
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
    });

    const rejection = expect(requestPromise).rejects.toThrow('MICROPHONE_ACCESS_TIMEOUT');
    await jest.advanceTimersByTimeAsync(1);
    await rejection;

    jest.useRealTimers();
  });

  it('re-resolves a selected microphone by stored label and group before capture', async () => {
    const selectedTracks = [{ stop: jest.fn() }];
    const selectedStream = {
      getAudioTracks: () => selectedTracks,
      getTracks: () => selectedTracks,
    };

    global.navigator.mediaDevices.enumerateDevices.mockResolvedValue([
      {
        deviceId: 'mic-new',
        groupId: 'group-usb',
        kind: 'audioinput',
        label: 'USB Podcast Mic',
      },
    ]);
    global.navigator.mediaDevices.getUserMedia.mockResolvedValue(selectedStream);

    await expect(
      requestRawMicrophoneStream('mic-old', {
        preferredDeviceGroupId: 'group-usb',
        preferredDeviceLabel: 'USB Podcast Mic',
      })
    ).resolves.toBe(selectedStream);

    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: 'mic-new' },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  it('keeps the fallback attempts when interactive access was already granted', async () => {
    jest.useFakeTimers();

    global.navigator.permissions.query.mockResolvedValue({ state: 'granted' });

    const lateTracks = [{ stop: jest.fn() }];
    const fallbackTracks = [{ stop: jest.fn() }];
    const lateStream = {
      getAudioTracks: () => lateTracks,
      getTracks: () => lateTracks,
    };
    const fallbackStream = {
      getAudioTracks: () => fallbackTracks,
      getTracks: () => fallbackTracks,
    };

    let resolveLateRequest: ((stream: typeof lateStream) => void) | null = null;
    global.navigator.mediaDevices.getUserMedia
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLateRequest = resolve;
          })
      )
      .mockResolvedValueOnce(fallbackStream);

    const requestPromise = requestRawMicrophoneStream('default', {
      interactive: true,
    });

    await jest.advanceTimersByTimeAsync(2_500);
    await Promise.resolve();

    await expect(requestPromise).resolves.toBe(fallbackStream);
    expect(global.navigator.permissions.query).toHaveBeenCalledWith({
      name: 'microphone',
    });
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: true,
    });
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    resolveLateRequest?.(lateStream);
    await Promise.resolve();
    expect(lateTracks[0]?.stop).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('builds Chromium-specific microphone recovery guidance', () => {
    expect(
      getPendingMicrophoneJoinMessage(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        microphoneMessages
      )
    ).toContain('address bar');
    expect(
      getTimedOutMicrophoneAccessMessage(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        microphoneMessages
      )
    ).toContain('Chrome site settings');
  });

  it('builds Firefox-specific microphone recovery guidance', () => {
    expect(
      getTimedOutMicrophoneAccessMessage(
        'Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0',
        microphoneMessages
      )
    ).toContain('left side of the address bar');
  });

  it('builds Safari-specific microphone recovery guidance', () => {
    expect(
      getTimedOutMicrophoneAccessMessage(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        microphoneMessages
      )
    ).toContain('Safari > Settings > Websites > Microphone');
  });

  it('formats permission labels for the setup UI', () => {
    expect(formatMicrophonePermissionStateLabel('granted', microphoneMessages)).toBe('Allowed');
    expect(formatMicrophonePermissionStateLabel('denied', microphoneMessages)).toBe('Blocked');
    expect(formatMicrophonePermissionStateLabel('prompt', microphoneMessages)).toBe(
      'Waiting for browser decision'
    );
    expect(formatMicrophonePermissionStateLabel('unknown', microphoneMessages)).toBe(
      'Browser-managed'
    );
  });

  it('builds prompt guidance that explains hidden device labels', () => {
    expect(
      getMicrophonePermissionHelpMessage('prompt', {
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        hasDetectedDevices: true,
        labelsVisible: false,
        messages: microphoneMessages,
      })
    ).toContain('Device names stay hidden until the browser grants microphone access.');
  });
});
