type SignupInviteInput = {
  email?: string;
  inviteToken?: string;
  projectInviteToken?: string;
};

function parseMaybeUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(trimmed, 'https://tasknebula.local');
    } catch {
      return null;
    }
  }
}

function cleanToken(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function extractAuthTokenInput(value: string, paramNames: readonly string[]): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const parsed = parseMaybeUrl(trimmed);
  if (parsed) {
    for (const paramName of paramNames) {
      const token = cleanToken(parsed.searchParams.get(paramName));
      if (token) return token;
    }
  }

  const queryStart = trimmed.indexOf('?');
  if (queryStart >= 0) {
    const params = new URLSearchParams(trimmed.slice(queryStart + 1));
    for (const paramName of paramNames) {
      const token = cleanToken(params.get(paramName));
      if (token) return token;
    }
  }

  return trimmed;
}

export function parseSignupInviteInput(value: string): SignupInviteInput {
  const parsed = parseMaybeUrl(value);
  const result: SignupInviteInput = {};

  if (parsed) {
    const email = cleanToken(parsed.searchParams.get('email'));
    const inviteToken = cleanToken(
      parsed.searchParams.get('token') ?? parsed.searchParams.get('inviteToken'),
    );
    const projectInviteToken = cleanToken(parsed.searchParams.get('projectInviteToken'));

    if (email) result.email = email.trim().toLowerCase();
    if (inviteToken) result.inviteToken = inviteToken;
    if (projectInviteToken) result.projectInviteToken = projectInviteToken;

    const joinMatch = parsed.pathname.match(/\/join\/project\/([^/?#]+)/);
    if (joinMatch?.[1]) {
      result.projectInviteToken = decodeURIComponent(joinMatch[1]);
    }
  }

  return result;
}
