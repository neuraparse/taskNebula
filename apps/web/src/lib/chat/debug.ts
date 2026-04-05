const CLIENT_DEBUG_STORAGE_KEY = 'tasknebula-chat-debug';
const MAX_DEBUG_DEPTH = 3;

function shouldDisableForTest() {
  return process.env.NODE_ENV === 'test';
}

function serializeDebugValue(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEBUG_DEPTH) {
    return '[max-depth]';
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof File !== 'undefined' && value instanceof File) {
    return {
      type: 'File',
      name: value.name,
      size: value.size,
      mimeType: value.type,
      lastModified: value.lastModified,
    };
  }

  if (typeof value === 'function') {
    return `[function ${value.name || 'anonymous'}]`;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeDebugValue(entry, depth + 1));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 40);
    return Object.fromEntries(entries.map(([key, entry]) => [key, serializeDebugValue(entry, depth + 1)]));
  }

  return value;
}

function isClientDebugEnabled() {
  if (shouldDisableForTest()) {
    return false;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(CLIENT_DEBUG_STORAGE_KEY);
    if (raw === '0') {
      return false;
    }
    if (raw === '1') {
      return true;
    }
  } catch {
    // Ignore localStorage failures.
  }

  const host = window.location.hostname;
  return ['localhost', '127.0.0.1', '[::1]'].includes(host) || host.endsWith('.local');
}

function isServerDebugEnabled() {
  if (shouldDisableForTest()) {
    return false;
  }

  return process.env.CHAT_DEBUG !== '0';
}

export function chatClientDebug(scope: string, payload?: Record<string, unknown>) {
  if (!isClientDebugEnabled()) {
    return;
  }

  console.log(`[chat-debug][client] ${scope}`, serializeDebugValue(payload ?? {}));
}

export function chatClientError(scope: string, payload?: Record<string, unknown>) {
  if (!isClientDebugEnabled()) {
    return;
  }

  console.error(`[chat-debug][client] ${scope}`, serializeDebugValue(payload ?? {}));
}

export function chatServerDebug(scope: string, payload?: Record<string, unknown>) {
  if (!isServerDebugEnabled()) {
    return;
  }

  console.log(`[chat-debug][server] ${scope}`, serializeDebugValue(payload ?? {}));
}

export function chatServerError(scope: string, payload?: Record<string, unknown>) {
  if (!isServerDebugEnabled()) {
    return;
  }

  console.error(`[chat-debug][server] ${scope}`, serializeDebugValue(payload ?? {}));
}
