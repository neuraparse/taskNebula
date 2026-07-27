/**
 * Storage layer.
 *
 * - MMKV: fast synchronous KV for non-secret state (UI prefs, the TanStack
 *   Query cache). Never put credentials here.
 * - react-native-keychain (iOS Keychain / Android Keystore): the per-server session
 *   cookie and any sensitive material. ~2KB per value — a session token fits.
 *
 * Self-hosted users may connect to several instances, so secrets are keyed by
 * an account id derived from `${serverUrl}` and never shared across servers.
 */
import { createMMKV } from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';

export const mmkv = createMMKV({ id: 'tasknebula' });

/** Sync storage adapter for @tanstack/query-sync-storage-persister. */
export const mmkvQueryStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => {
    mmkv.remove(key);
  },
};

/** SecureStore keys are restricted to [A-Za-z0-9._-]; keep a readable prefix plus a hash. */
function secureKey(raw: string): string {
  const prime = 2147483647;
  let h1 = 5381;
  let h2 = 52711;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw.charCodeAt(index);
    h1 = (h1 * 33 + char) % prime;
    h2 = (h2 * 65599 + char) % prime;
  }

  const slug = raw
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 48)
    .replace(/^_+|_+$/g, '');
  const hash = `${h2.toString(36)}${h1.toString(36)}`;
  return `${slug || 'key'}.${hash}`;
}

function legacySecureKey(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function readSecureService(service: string): Promise<string | null> {
  // Keychain's existence check treats a missing item as the normal false case.
  // Calling getGenericPassword for every missing service makes RNKeychainManager
  // emit an error-level log during first launch, even though nothing is broken.
  if (!(await Keychain.hasGenericPassword({ service }))) return null;
  const credentials = await Keychain.getGenericPassword({ service });
  return credentials ? credentials.password : null;
}

export async function setSecure(key: string, value: string): Promise<void> {
  const service = secureKey(key);
  await Keychain.setGenericPassword(service, value, {
    service,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getSecure(key: string): Promise<string | null> {
  const service = secureKey(key);
  const value = await readSecureService(service);
  if (value !== null) return value;

  const legacyService = legacySecureKey(key);
  if (legacyService === service) return null;

  const legacyValue = await readSecureService(legacyService);
  if (!legacyValue) return null;

  await setSecure(key, legacyValue);
  await Keychain.resetGenericPassword({ service: legacyService });
  return legacyValue;
}

export async function deleteSecure(key: string): Promise<void> {
  const service = secureKey(key);
  await Keychain.resetGenericPassword({ service });
  const legacyService = legacySecureKey(key);
  if (legacyService !== service) {
    await Keychain.resetGenericPassword({ service: legacyService });
  }
}
