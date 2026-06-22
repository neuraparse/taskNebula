const DEFAULT_APP_BASE_URL = 'http://localhost:3000';

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function getAppBaseUrl(origin?: string): string {
  const candidates = [
    process.env.APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    origin,
    DEFAULT_APP_BASE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }

  return DEFAULT_APP_BASE_URL;
}

export function buildAppUrl(path: string, origin?: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAppBaseUrl(origin)}${normalizedPath}`;
}
