import i18next from 'i18next';
import { config } from '@/config/env';
import { normalizeBaseUrl } from '@/lib/server-url';

export { normalizeBaseUrl };

type JsonBody = Record<string, unknown> | unknown[];

type ApiFetchOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: JsonBody;
  headers?: Record<string, string>;
};

let baseUrl: string | null = config.apiBaseUrl;
let cookie: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function configureApi(next: { baseUrl?: string | null; cookie?: string | null }): void {
  if ('baseUrl' in next) {
    baseUrl = normalizeBaseUrl(next.baseUrl) ?? null;
  }
  if ('cookie' in next) {
    cookie = next.cookie ?? null;
  }
}

export function getBaseUrl(): string | null {
  return baseUrl;
}

export function getAuthCookie(): string | null {
  return cookie;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function buildUrl(path: string, targetBaseUrl: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${targetBaseUrl}${normalizedPath}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = response.statusText || `HTTP ${response.status}`;
  const text = await response.text().catch(() => '');
  if (!text) return fallback;

  try {
    const data = JSON.parse(text) as {
      error?: unknown;
      message?: unknown;
      details?: unknown;
    };
    const message = data.error ?? data.message ?? data.details;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message) && message.length > 0) return message.join(', ');
  } catch {
    // Plain-text error body.
  }

  return text || fallback;
}

function splitSetCookieHeader(value: string): string[] {
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g).map((part) => part.trim());
}

function cookiePairs(jar: string | null | undefined): Map<string, string> {
  const pairs = new Map<string, string>();
  if (!jar) return pairs;

  for (const part of jar.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    pairs.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return pairs;
}

export function extractCookies(
  setCookieHeader: string | null | undefined,
  namePattern?: RegExp,
): string {
  if (!setCookieHeader) return '';

  const pairs = new Map<string, string>();
  for (const item of splitSetCookieHeader(setCookieHeader)) {
    const [pair] = item.split(';');
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!namePattern || namePattern.test(name)) {
      pairs.set(name, value);
    }
  }

  return [...pairs].map(([name, value]) => `${name}=${value}`).join('; ');
}

export function mergeCookies(current: string | null | undefined, next: string | null | undefined) {
  const merged = cookiePairs(current);
  for (const [name, value] of cookiePairs(next)) {
    merged.set(name, value);
  }
  return [...merged].map(([name, value]) => `${name}=${value}`).join('; ');
}

export async function apiJson<TResponse>(path: string, init: RequestInit = {}): Promise<TResponse> {
  if (!baseUrl) {
    throw new ApiError(0, i18next.t('errors.noServerConfigured'));
  }

  const headers = new Headers(init.headers);
  headers.set('Accept', headers.get('Accept') ?? 'application/json');
  headers.set('Accept-Language', i18next.language);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (cookie && !headers.has('Cookie')) {
    headers.set('Cookie', cookie);
  }

  const response = await fetch(buildUrl(path, baseUrl), {
    ...init,
    headers,
  });

  if (response.status === 401 && unauthorizedHandler) {
    unauthorizedHandler();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export async function apiText(path: string, init: RequestInit = {}): Promise<string> {
  if (!baseUrl) {
    throw new ApiError(0, i18next.t('errors.noServerConfigured'));
  }

  const headers = new Headers(init.headers);
  headers.set('Accept', headers.get('Accept') ?? 'text/event-stream');
  headers.set('Accept-Language', i18next.language);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (cookie && !headers.has('Cookie')) {
    headers.set('Cookie', cookie);
  }

  const response = await fetch(buildUrl(path, baseUrl), {
    ...init,
    headers,
  });

  if (response.status === 401 && unauthorizedHandler) {
    unauthorizedHandler();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  return response.text();
}

export async function apiFetch<TResponse>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<TResponse> {
  const { body, ...requestOptions } = options;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': i18next.language,
    ...(options.headers ?? {}),
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (cookie) {
    headers.Cookie = cookie;
  }

  const requestInit: RequestInit = {
    ...requestOptions,
    headers,
  };
  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  const targetBaseUrl = baseUrl ?? config.apiBaseUrl;
  if (!targetBaseUrl) {
    throw new ApiError(0, i18next.t('errors.noServerConfigured'));
  }

  const response = await fetch(buildUrl(path, targetBaseUrl), requestInit);

  if (response.status === 401 && unauthorizedHandler) {
    unauthorizedHandler();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export async function apiFormData<TResponse>(
  path: string,
  formData: FormData,
  init: Omit<RequestInit, 'body' | 'headers'> & { headers?: Record<string, string> } = {},
): Promise<TResponse> {
  if (!baseUrl) {
    throw new ApiError(0, i18next.t('errors.noServerConfigured'));
  }

  const headers = new Headers(init.headers);
  headers.set('Accept', headers.get('Accept') ?? 'application/json');
  headers.set('Accept-Language', i18next.language);

  if (cookie && !headers.has('Cookie')) {
    headers.set('Cookie', cookie);
  }

  const response = await fetch(buildUrl(path, baseUrl), {
    ...init,
    headers,
    body: formData,
  });

  if (response.status === 401 && unauthorizedHandler) {
    unauthorizedHandler();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
