/**
 * Yjs collaboration provider factory.
 *
 * Wraps `@hocuspocus/provider` so we can attach the current user's JWT and
 * pass a Yjs doc that Tiptap's collaboration extension can bind to.
 *
 * The Hocuspocus server URL is read from `NEXT_PUBLIC_HOCUSPOCUS_URL`
 * (e.g. `ws://localhost:1234`). Token authentication is forwarded via the
 * provider's `token` option — the server-side `services/hocuspocus` script
 * verifies it with the shared `NEXTAUTH_SECRET` / `AUTH_SECRET`.
 *
 * The factory is environment-agnostic: in tests we inject a stub `provider`
 * factory and (optionally) a `doc` factory so we can assert what gets passed
 * without booting an actual Yjs document.
 */
import type { HocuspocusProvider, HocuspocusProviderConfiguration } from '@hocuspocus/provider';
import { HocuspocusProvider as DefaultHocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

export interface CollabProviderOptions {
  /**
   * Document name. Issues use `issue:<id>` — keeps the namespace explicit so
   * comments/threads can later co-exist on the same Hocuspocus server.
   */
  documentName: string;
  /**
   * Short-lived JWT minted by the web app and passed straight through to the
   * Hocuspocus server's onAuthenticate hook. May be undefined while the
   * session is still loading; the provider will reconnect once supplied.
   */
  token?: string | null;
  /**
   * Override the public Hocuspocus URL. Defaults to
   * `process.env.NEXT_PUBLIC_HOCUSPOCUS_URL`.
   */
  url?: string;
  /**
   * Pre-existing Yjs document to bind to. Useful for testing or when the
   * caller wants to share a doc between multiple editors.
   */
  doc?: Y.Doc;
  /**
   * Whether the provider should auto-connect on construction. Defaults to
   * `true`.
   */
  connect?: boolean;
  /**
   * DI seam for tests. Defaults to the real `HocuspocusProvider`.
   */
  ProviderImpl?: new (config: HocuspocusProviderConfiguration) => HocuspocusProvider;
  /**
   * DI seam for tests. Defaults to constructing a fresh `Y.Doc`.
   */
  createDoc?: () => Y.Doc;
}

export interface CollabProviderHandle {
  provider: HocuspocusProvider;
  doc: Y.Doc;
  /** Convenience disposer that disconnects + frees the doc. */
  destroy: () => void;
}

/**
 * Resolve the configured Hocuspocus WebSocket URL, falling back to localhost
 * in development. Returns `null` when no URL is configured — callers should
 * treat that as "collaboration disabled" rather than crashing.
 */
export function resolveHocuspocusUrl(override?: string): string | null {
  if (override && override.trim()) {
    return override.trim();
  }
  const fromEnv =
    typeof process !== 'undefined' && process.env
      ? process.env.NEXT_PUBLIC_HOCUSPOCUS_URL
      : undefined;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }
  return null;
}

/**
 * Build a Hocuspocus provider for the given document. Returns `null` if no
 * Hocuspocus URL is configured (so callers can degrade gracefully to the
 * static editor).
 */
export function createCollabProvider(options: CollabProviderOptions): CollabProviderHandle | null {
  const url = resolveHocuspocusUrl(options.url);
  if (!url) {
    return null;
  }

  const documentName = options.documentName.trim();
  if (!documentName) {
    throw new Error('createCollabProvider: documentName is required');
  }

  const ProviderImpl = options.ProviderImpl ?? DefaultHocuspocusProvider;
  const docFactory = options.createDoc ?? (() => new Y.Doc());
  const doc = options.doc ?? docFactory();

  const config: HocuspocusProviderConfiguration = {
    url,
    name: documentName,
    document: doc,
    token: options.token ?? undefined,
    connect: options.connect ?? true,
  };

  const provider = new ProviderImpl(config);

  return {
    provider,
    doc,
    destroy: () => {
      try {
        provider.disconnect();
      } catch {
        // ignore — provider may already be disconnected
      }
      try {
        provider.destroy();
      } catch {
        // ignore
      }
      if (!options.doc) {
        // Only destroy docs we created ourselves.
        doc.destroy();
      }
    },
  };
}

/**
 * Stable per-user color used to differentiate remote cursors. Hash the user
 * id (or email) into one of a small curated palette so the same person keeps
 * the same color across reconnects.
 */
const PRESENCE_PALETTE: readonly string[] = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
];

const PRESENCE_FALLBACK = '#6366f1';

export function presenceColorFor(id: string | null | undefined): string {
  if (!id) return PRESENCE_PALETTE[0] ?? PRESENCE_FALLBACK;
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PRESENCE_PALETTE.length;
  return PRESENCE_PALETTE[index] ?? PRESENCE_FALLBACK;
}
