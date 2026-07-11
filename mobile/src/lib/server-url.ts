export function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  if (trimmed.startsWith('//')) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${defaultProtocolForHost(trimmed)}://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isSameBaseUrl(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeBaseUrl(left);
  const normalizedRight = normalizeBaseUrl(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function defaultProtocolForHost(input: string): 'http' | 'https' {
  const authority = input.split('/')[0]?.toLowerCase();
  const host = authority?.startsWith('[')
    ? authority.slice(1, authority.indexOf(']'))
    : authority?.split(':')[0];

  if (!host) return 'https';
  if (host === 'localhost' || host === '::1' || host.endsWith('.localhost')) return 'http';
  if (host.endsWith('.local')) return 'http';
  if (host === '10.0.2.2' || host.startsWith('127.')) return 'http';
  if (host.startsWith('10.') || host.startsWith('192.168.')) return 'http';
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return 'http';
  return 'https';
}
