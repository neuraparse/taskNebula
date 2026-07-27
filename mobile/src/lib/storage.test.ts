const mockSetGenericPassword = jest.fn();
const mockHasGenericPassword = jest.fn();
const mockGetGenericPassword = jest.fn();
const mockResetGenericPassword = jest.fn();

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    remove: jest.fn(),
    set: jest.fn(),
  })),
}));

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
  },
  setGenericPassword: (...args: unknown[]) => mockSetGenericPassword(...args),
  hasGenericPassword: (...args: unknown[]) => mockHasGenericPassword(...args),
  getGenericPassword: (...args: unknown[]) => mockGetGenericPassword(...args),
  resetGenericPassword: (...args: unknown[]) => mockResetGenericPassword(...args),
}));

import { deleteSecure, getSecure, setSecure } from './storage';

describe('secure storage keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasGenericPassword.mockResolvedValue(true);
  });

  it('stores values under deterministic keychain services with device-only accessibility', async () => {
    await setSecure('session_cookie::https://tasks.example.com', 'authjs.session-token=s1');

    const [username, password, options] = mockSetGenericPassword.mock.calls[0] ?? [];
    expect(username).toBe(options.service);
    expect(password).toBe('authjs.session-token=s1');
    expect(options).toMatchObject({
      accessible: 'when-unlocked-this-device-only',
    });
  });

  it('keeps self-hosted secure keys distinct even when sanitized prefixes collide', async () => {
    const firstRawKey = 'session_cookie::https://tasks.example.com';
    const secondRawKey = 'session_cookie__https___tasks.example.com';

    await setSecure(firstRawKey, 'first-cookie');
    await setSecure(secondRawKey, 'second-cookie');

    const firstService = mockSetGenericPassword.mock.calls[0]?.[2]?.service;
    const secondService = mockSetGenericPassword.mock.calls[1]?.[2]?.service;
    expect(firstService).toMatch(/^session_cookie__https___tasks.example.com\./);
    expect(secondService).toMatch(/^session_cookie__https___tasks.example.com\./);
    expect(firstService).not.toBe(secondService);
  });

  it('uses the same service when reading and deleting a secure value', async () => {
    mockGetGenericPassword.mockResolvedValue({ username: 'key', password: 'stored-cookie' });

    await setSecure('session_cookie::https://tasks.example.com', 'stored-cookie');
    await expect(getSecure('session_cookie::https://tasks.example.com')).resolves.toBe(
      'stored-cookie',
    );
    await deleteSecure('session_cookie::https://tasks.example.com');

    const service = mockSetGenericPassword.mock.calls[0]?.[2]?.service;
    expect(mockGetGenericPassword).toHaveBeenCalledWith({ service });
    expect(mockResetGenericPassword).toHaveBeenCalledWith({ service });
    expect(mockResetGenericPassword).toHaveBeenCalledWith({
      service: 'session_cookie__https___tasks.example.com',
    });
  });

  it('migrates legacy sanitized services to collision-safe hashed services when reading', async () => {
    const rawKey = 'session_cookie::https://tasks.example.com';
    mockHasGenericPassword.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockGetGenericPassword.mockResolvedValueOnce({
      username: 'session_cookie__https___tasks.example.com',
      password: 'legacy-cookie',
    });

    await expect(getSecure(rawKey)).resolves.toBe('legacy-cookie');

    expect(mockHasGenericPassword).toHaveBeenNthCalledWith(1, {
      service: expect.stringMatching(/^session_cookie__https___tasks.example.com\./),
    });
    expect(mockHasGenericPassword).toHaveBeenNthCalledWith(2, {
      service: 'session_cookie__https___tasks.example.com',
    });
    expect(mockGetGenericPassword).toHaveBeenCalledWith({
      service: 'session_cookie__https___tasks.example.com',
    });
    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      expect.stringMatching(/^session_cookie__https___tasks.example.com\./),
      'legacy-cookie',
      expect.objectContaining({
        service: expect.stringMatching(/^session_cookie__https___tasks.example.com\./),
      }),
    );
    expect(mockResetGenericPassword).toHaveBeenCalledWith({
      service: 'session_cookie__https___tasks.example.com',
    });
  });

  it('does not read a missing keychain item during first launch', async () => {
    mockHasGenericPassword.mockResolvedValue(false);

    await expect(getSecure('server_url')).resolves.toBeNull();

    expect(mockHasGenericPassword).toHaveBeenCalledTimes(2);
    expect(mockGetGenericPassword).not.toHaveBeenCalled();
  });
});
