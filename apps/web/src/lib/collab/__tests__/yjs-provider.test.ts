/**
 * Tests for the Yjs / Hocuspocus provider factory.
 *
 * We avoid mounting a real WebSocket by passing a `ProviderImpl` stub that
 * captures the configuration handed to the provider — this is sufficient to
 * cover the contract we care about: env-driven URL resolution, token
 * forwarding, and doc lifecycle.
 */
import * as Y from 'yjs';
import {
  createCollabProvider,
  presenceColorFor,
  resolveHocuspocusUrl,
} from '../yjs-provider';

type Listener = (event: unknown) => void;

class FakeProvider {
  static lastConfig: any = null;
  public listeners = new Map<string, Set<Listener>>();
  public disconnected = false;
  public destroyed = false;
  constructor(config: any) {
    FakeProvider.lastConfig = config;
  }
  on(event: string, listener: Listener) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }
  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener);
  }
  disconnect() {
    this.disconnected = true;
  }
  destroy() {
    this.destroyed = true;
  }
}

describe('resolveHocuspocusUrl', () => {
  const originalEnv = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_HOCUSPOCUS_URL;
    } else {
      process.env.NEXT_PUBLIC_HOCUSPOCUS_URL = originalEnv;
    }
  });

  it('returns null when no URL is configured', () => {
    delete process.env.NEXT_PUBLIC_HOCUSPOCUS_URL;
    expect(resolveHocuspocusUrl()).toBeNull();
  });

  it('prefers an explicit override over the env var', () => {
    process.env.NEXT_PUBLIC_HOCUSPOCUS_URL = 'ws://from-env:1234';
    expect(resolveHocuspocusUrl('ws://override:1234')).toBe('ws://override:1234');
  });

  it('falls back to NEXT_PUBLIC_HOCUSPOCUS_URL when no override is given', () => {
    process.env.NEXT_PUBLIC_HOCUSPOCUS_URL = 'ws://from-env:1234';
    expect(resolveHocuspocusUrl()).toBe('ws://from-env:1234');
  });
});

describe('createCollabProvider', () => {
  afterEach(() => {
    FakeProvider.lastConfig = null;
    delete process.env.NEXT_PUBLIC_HOCUSPOCUS_URL;
  });

  it('returns null when no Hocuspocus URL is configured', () => {
    const handle = createCollabProvider({
      documentName: 'issue:123',
      token: 'jwt',
      ProviderImpl: FakeProvider as any,
    });
    expect(handle).toBeNull();
    expect(FakeProvider.lastConfig).toBeNull();
  });

  it('throws if documentName is empty', () => {
    expect(() =>
      createCollabProvider({
        documentName: '   ',
        token: 'jwt',
        url: 'ws://test:1234',
        ProviderImpl: FakeProvider as any,
      })
    ).toThrow(/documentName/);
  });

  it('forwards the URL, document name, and JWT token to the provider', () => {
    const handle = createCollabProvider({
      documentName: 'issue:abc',
      token: 'jwt-token-123',
      url: 'ws://collab:1234',
      ProviderImpl: FakeProvider as any,
    });

    expect(handle).not.toBeNull();
    expect(FakeProvider.lastConfig).toMatchObject({
      url: 'ws://collab:1234',
      name: 'issue:abc',
      token: 'jwt-token-123',
      connect: true,
    });
    expect(FakeProvider.lastConfig.document).toBeInstanceOf(Y.Doc);

    handle?.destroy();
  });

  it('honors the env-provided URL when no override is given', () => {
    process.env.NEXT_PUBLIC_HOCUSPOCUS_URL = 'ws://env-host:1234';
    const handle = createCollabProvider({
      documentName: 'issue:env',
      token: 'jwt',
      ProviderImpl: FakeProvider as any,
    });
    expect(handle).not.toBeNull();
    expect(FakeProvider.lastConfig.url).toBe('ws://env-host:1234');
    handle?.destroy();
  });

  it('uses the provided Yjs doc instead of creating a new one and leaves it alive on destroy', () => {
    const sharedDoc = new Y.Doc();
    const destroySpy = jest.spyOn(sharedDoc, 'destroy');

    const handle = createCollabProvider({
      documentName: 'issue:shared',
      token: 'jwt',
      url: 'ws://collab:1234',
      doc: sharedDoc,
      ProviderImpl: FakeProvider as any,
    });

    expect(handle?.doc).toBe(sharedDoc);
    handle?.destroy();
    expect(destroySpy).not.toHaveBeenCalled();
  });

  it('destroys docs it owns when destroy() is called', () => {
    const handle = createCollabProvider({
      documentName: 'issue:owned',
      token: 'jwt',
      url: 'ws://collab:1234',
      ProviderImpl: FakeProvider as any,
    });
    expect(handle).not.toBeNull();
    const provider = handle!.provider as unknown as FakeProvider;
    const destroySpy = jest.spyOn(handle!.doc, 'destroy');
    handle!.destroy();
    expect(provider.disconnected).toBe(true);
    expect(provider.destroyed).toBe(true);
    expect(destroySpy).toHaveBeenCalled();
  });

  it('passes undefined when token is null so the provider does not send a falsy auth header', () => {
    createCollabProvider({
      documentName: 'issue:notok',
      token: null,
      url: 'ws://collab:1234',
      ProviderImpl: FakeProvider as any,
    });
    expect(FakeProvider.lastConfig.token).toBeUndefined();
  });
});

describe('presenceColorFor', () => {
  it('returns a stable color for the same id', () => {
    expect(presenceColorFor('user-1')).toBe(presenceColorFor('user-1'));
  });

  it('returns a string starting with # (hex color)', () => {
    expect(presenceColorFor('user-1')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('handles nullish ids without throwing', () => {
    expect(presenceColorFor(null)).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(presenceColorFor(undefined)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
