/**
 * Thin REST client around the TaskNebula HTTP API.
 *
 * Every tool delegates to this client so we keep auth, headers, and
 * error normalization in one place. The client is intentionally minimal —
 * we want the MCP server to be a *transport*, not a re-implementation of
 * domain logic that already lives in the Next.js API routes.
 */

export interface TaskNebulaClientOptions {
  /** Base URL of the TaskNebula REST API, e.g. `https://app.tasknebula.io`. */
  apiUrl: string;
  /** API key issued from the TaskNebula UI (Settings → API keys). */
  apiKey?: string;
  /**
   * Optional OAuth access token (used by the HTTP/Streamable transport once
   * we wire up the OAuth 2.1 + PKCE flow — see `src/auth.ts`). If both are
   * supplied, `accessToken` wins.
   */
  accessToken?: string;
  /** Per-request timeout in ms. Defaults to 30s. */
  timeoutMs?: number;
  /** Optional fetch implementation override (used by tests). */
  fetchImpl?: typeof fetch;
}

export class TaskNebulaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `TaskNebula API error ${status} ${statusText}`);
    this.name = 'TaskNebulaApiError';
  }
}

export class TaskNebulaClient {
  private readonly apiUrl: string;
  private readonly apiKey?: string;
  private readonly accessToken?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: TaskNebulaClientOptions) {
    if (!opts.apiUrl) {
      throw new Error('TASKNEBULA_API_URL is required');
    }
    this.apiUrl = opts.apiUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.accessToken = opts.accessToken;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': '@tasknebula/mcp-server',
    };
    if (this.accessToken) {
      h.Authorization = `Bearer ${this.accessToken}`;
    } else if (this.apiKey) {
      // TaskNebula REST API accepts either `Authorization: Bearer` (OAuth) or
      // `X-API-Key` (long-lived keys). Sending both is harmless.
      h['X-API-Key'] = this.apiKey;
      h.Authorization = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.apiUrl + '/');
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.set(k, String(v));
        }
      }
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url.toString(), {
        method,
        headers: this.headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let parsed: unknown;
      if (text.length === 0) {
        parsed = null;
      } else {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }
      if (!res.ok) {
        throw new TaskNebulaApiError(res.status, res.statusText, parsed);
      }
      return parsed as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  get<T = unknown>(path: string, query?: Record<string, string | number | boolean | undefined | null>) {
    return this.request<T>('GET', path, undefined, query);
  }
  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }
  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body);
  }
  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body);
  }
  delete<T = unknown>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

/** Build a client from environment variables (used by the stdio transport). */
export function clientFromEnv(env: NodeJS.ProcessEnv = process.env): TaskNebulaClient {
  const apiUrl = env.TASKNEBULA_API_URL ?? 'http://localhost:3000';
  const apiKey = env.TASKNEBULA_API_KEY;
  return new TaskNebulaClient({ apiUrl, apiKey });
}
