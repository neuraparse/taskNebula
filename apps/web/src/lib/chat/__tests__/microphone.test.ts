import {
  formatMicrophonePermissionStateLabel,
  getMicrophonePermissionHelpMessage,
  getPendingMicrophoneJoinMessage,
  getTimedOutMicrophoneAccessMessage,
  requestRawMicrophoneStream,
  resolveJoinAudioInputDeviceId,
} from '@/lib/chat/microphone';

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
      .mockRejectedValueOnce(new Error('The AudioContext encountered an error from the audio device or the WebAudio renderer.'))
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

  it('prefers the resolved concrete microphone device before retrying the default alias', async () => {
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

    await expect(requestRawMicrophoneStream('default')).resolves.toBe(concreteStream);
    expect(global.navigator.mediaDevices.enumerateDevices).toHaveBeenCalledTimes(1);
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: {
        deviceId: { exact: 'usb-arctis' },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
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

    const rejection = expect(requestPromise).rejects.toThrow(
      'Microphone access timed out while waiting for the browser prompt.'
    );
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
    ).rejects.toThrow('Microphone permission was denied.');

    expect(global.navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('still resolves the concrete default microphone when the permissions API cannot report state', async () => {
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
      audio: {
        deviceId: { exact: 'usb-arctis' },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
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
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
      )
    ).toContain('address bar');
    expect(
      getTimedOutMicrophoneAccessMessage(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
      )
    ).toContain('Chrome site settings');
  });

  it('builds Firefox-specific microphone recovery guidance', () => {
    expect(
      getTimedOutMicrophoneAccessMessage(
        'Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0'
      )
    ).toContain('left side of the address bar');
  });

  it('builds Safari-specific microphone recovery guidance', () => {
    expect(
      getTimedOutMicrophoneAccessMessage(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
      )
    ).toContain('Safari > Settings > Websites > Microphone');
  });

  it('formats permission labels for the setup UI', () => {
    expect(formatMicrophonePermissionStateLabel('granted')).toBe('Allowed');
    expect(formatMicrophonePermissionStateLabel('denied')).toBe('Blocked');
    expect(formatMicrophonePermissionStateLabel('prompt')).toBe(
      'Waiting for browser decision'
    );
    expect(formatMicrophonePermissionStateLabel('unknown')).toBe('Browser-managed');
  });

  it('builds prompt guidance that explains hidden device labels', () => {
    expect(
      getMicrophonePermissionHelpMessage('prompt', {
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        hasDetectedDevices: true,
        labelsVisible: false,
      })
    ).toContain('Device names stay hidden until the browser grants microphone access.');
  });
});
