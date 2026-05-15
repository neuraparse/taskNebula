/**
 * Shared retry/backoff helper for importer adapters.
 *
 * Every importer (Linear, Jira, GitHub) hits an external HTTP API that
 * rate-limits aggressively and occasionally drops requests. Naked `fetch`
 * surfaces a single 429/5xx as an import-killing 500. This helper retries
 * on:
 *
 *   - `fetch` rejecting with a network error,
 *   - HTTP 429 (rate limited),
 *   - HTTP 500–599 (transient server errors).
 *
 * Backoff is exponential with full jitter and an upper bound, capped at
 * `maxRetries` attempts (default 4 → 5 total tries). When the response
 * carries `Retry-After` (seconds or HTTP-date), we honour it for the next
 * attempt. After the budget is exhausted the last response (or thrown
 * error) is returned/rethrown so the caller can surface a useful message.
 *
 * The helper is intentionally framework-agnostic: it accepts the same
 * `(input, init?)` signature as global `fetch`, so adapters can drop it
 * in by replacing `fetch(...)` with `fetchWithBackoff(...)`.
 */

const DEFAULT_MAX_RETRIES = 4;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 15_000;

export interface FetchBackoffOptions {
  maxRetries?: number;
  /** Override the default exponential schedule (for tests). */
  delayMs?: (attempt: number) => number;
  /** Callback fired before each retry; mostly for telemetry/tests. */
  onRetry?: (info: { attempt: number; delayMs: number; status?: number; cause?: unknown }) => void;
}

function defaultDelay(attempt: number): number {
  const expo = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  // Full jitter: pick uniformly in [0, expo]. Keeps retrying clients from
  // synchronising into a thundering herd after the upstream resets.
  return Math.floor(Math.random() * expo);
}

function retryAfterMs(response: Response): number | null {
  const raw = response.headers.get('retry-after');
  if (!raw) return null;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) return Math.max(0, asNumber * 1000);
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithBackoff(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: FetchBackoffOptions = {}
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const delayMs = opts.delayMs ?? defaultDelay;

  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);
      // 2xx/3xx/4xx (except 429) — return immediately. Importers handle
      // 4xx-with-body themselves.
      if (response.status !== 429 && response.status < 500) {
        return response;
      }
      lastResponse = response;
      if (attempt === maxRetries) break;
      const honoured = retryAfterMs(response);
      const wait = honoured ?? delayMs(attempt);
      opts.onRetry?.({ attempt, delayMs: wait, status: response.status });
      await sleep(wait);
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;
      const wait = delayMs(attempt);
      opts.onRetry?.({ attempt, delayMs: wait, cause: err });
      await sleep(wait);
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError ?? new Error('fetchWithBackoff: no response and no error captured');
}
