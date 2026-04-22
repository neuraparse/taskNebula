/**
 * @jest-environment node
 *
 * Encryption + credential resolution tests. The resolution chain is:
 *   workspace (org.settings.aiAgentSecrets)
 *     → platform (systemSettings.providerCredentials)
 *     → server env (OPENAI_API_KEY / ANTHROPIC_API_KEY) as a dev fallback
 */

const ORIGINAL_AUTH_SECRET = process.env.AUTH_SECRET;

beforeAll(() => {
  // Encryption key is derived from AUTH_SECRET — make sure one is present.
  process.env.AUTH_SECRET = 'test-auth-secret-for-credential-encryption';
});

afterAll(() => {
  if (ORIGINAL_AUTH_SECRET === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = ORIGINAL_AUTH_SECRET;
  }
});

import {
  getProviderCredentialStatusFromSettings,
  resolveProviderApiKeyFromSettings,
  upsertProviderSecretInSettings,
  removeProviderSecretFromSettings,
  upsertPlatformSecretInStore,
  removePlatformSecretFromStore,
  sanitizePlatformSecretStore,
} from '../credentials';

describe('workspace credential round-trip', () => {
  it('encrypts, decrypts, redacts OpenAI keys', () => {
    const withSecret = upsertProviderSecretInSettings({
      settings: {},
      provider: 'openai',
      apiKey: 'sk-proj-test-123456789012345',
      userId: 'u-1',
    });

    const status = getProviderCredentialStatusFromSettings(withSecret, 'openai');
    expect(status.configured).toBe(true);
    expect(status.source).toBe('workspace');
    expect(status.label?.startsWith('••••')).toBe(true);

    const plain = resolveProviderApiKeyFromSettings(withSecret, 'openai');
    expect(plain).toBe('sk-proj-test-123456789012345');
  });

  it('encrypts + decrypts Anthropic keys (new slot)', () => {
    const withSecret = upsertProviderSecretInSettings({
      settings: {},
      provider: 'anthropic',
      apiKey: 'sk-ant-test-abcdefghijklmnopqrstuv',
      userId: 'u-1',
    });

    const status = getProviderCredentialStatusFromSettings(withSecret, 'anthropic');
    expect(status.configured).toBe(true);
    expect(status.source).toBe('workspace');

    const plain = resolveProviderApiKeyFromSettings(withSecret, 'anthropic');
    expect(plain).toBe('sk-ant-test-abcdefghijklmnopqrstuv');
  });

  it('remove clears the slot', () => {
    const added = upsertProviderSecretInSettings({
      settings: {},
      provider: 'anthropic',
      apiKey: 'sk-ant-test-abcdefghijklmnopqrstuv',
      userId: 'u-1',
    });
    const removed = removeProviderSecretFromSettings({
      settings: added,
      provider: 'anthropic',
    });
    const status = getProviderCredentialStatusFromSettings(removed, 'anthropic');
    expect(status.configured).toBe(false);
  });
});

describe('resolution fall-through', () => {
  const originalOpenai = process.env.OPENAI_API_KEY;
  const originalAnthropic = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (originalOpenai === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenai;
    if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropic;
  });

  it('platform credential overrides env when workspace has none', () => {
    process.env.OPENAI_API_KEY = 'sk-env-fallback';

    const platform = upsertPlatformSecretInStore({
      store: {},
      provider: 'openai',
      apiKey: 'sk-platform-default-1234567890',
      userId: 'admin',
    });

    const status = getProviderCredentialStatusFromSettings({}, 'openai', platform);
    expect(status.configured).toBe(true);
    expect(status.source).toBe('platform');

    const plain = resolveProviderApiKeyFromSettings({}, 'openai', platform);
    expect(plain).toBe('sk-platform-default-1234567890');
  });

  it('workspace beats platform and env', () => {
    process.env.OPENAI_API_KEY = 'sk-env';
    const platform = upsertPlatformSecretInStore({
      store: {},
      provider: 'openai',
      apiKey: 'sk-platform',
      userId: 'admin',
    });
    const workspace = upsertProviderSecretInSettings({
      settings: {},
      provider: 'openai',
      apiKey: 'sk-workspace-wins-1234567890',
      userId: 'u-1',
    });

    const plain = resolveProviderApiKeyFromSettings(workspace, 'openai', platform);
    expect(plain).toBe('sk-workspace-wins-1234567890');
  });

  it('env is used only when neither workspace nor platform is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env-fallback';
    const status = getProviderCredentialStatusFromSettings({}, 'anthropic');
    expect(status.configured).toBe(true);
    expect(status.source).toBe('server_env');
  });

  it('returns not-configured when nothing is available', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const status = getProviderCredentialStatusFromSettings({}, 'anthropic');
    expect(status.configured).toBe(false);
    expect(status.source).toBe(null);
  });
});

describe('sanitizePlatformSecretStore', () => {
  it('strips ciphertext/iv/authTag and keeps only metadata', () => {
    const store = upsertPlatformSecretInStore({
      store: {},
      provider: 'openai',
      apiKey: 'sk-test-1234567890abcdef',
      userId: 'admin',
    });
    const safe = sanitizePlatformSecretStore(store);
    expect(safe.openai).toMatchObject({
      preview: expect.stringMatching(/^••••/),
      updatedBy: 'admin',
    });
    expect(safe.openai).not.toHaveProperty('ciphertext');
    expect(safe.openai).not.toHaveProperty('iv');
    expect(safe.openai).not.toHaveProperty('authTag');
    expect(safe.anthropic).toBe(null);
  });
});

describe('removePlatformSecretFromStore', () => {
  it('deletes only the named provider', () => {
    let store = upsertPlatformSecretInStore({
      store: {},
      provider: 'openai',
      apiKey: 'sk-openai-test-1234567890',
      userId: 'admin',
    });
    store = upsertPlatformSecretInStore({
      store,
      provider: 'anthropic',
      apiKey: 'sk-ant-test-abcdefghijklmnop',
      userId: 'admin',
    });
    const after = removePlatformSecretFromStore({ store, provider: 'anthropic' });
    expect(after.openai).toBeDefined();
    expect(after.anthropic).toBeUndefined();
  });
});
