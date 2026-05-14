/**
 * Cloudflare Turnstile verification. Reads `TURNSTILE_SECRET_KEY` and
 * `RECAPTCHA_SECRET_KEY` env vars; if neither is set the verifier is a
 * no-op (returns true). This lets us ship the intake feature with the
 * captcha plumbing wired through without forcing every deployment to
 * configure a third-party secret on day one.
 */

const TURNSTILE_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RECAPTCHA_ENDPOINT = 'https://www.google.com/recaptcha/api/siteverify';

export interface CaptchaConfig {
  // Token from the client-side widget.
  token?: string | null;
  // Best-effort remote IP for proof-of-source. Optional.
  remoteIp?: string | null;
}

export function isCaptchaConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY);
}

/**
 * Returns true when the provided token verifies, OR when no captcha
 * provider is configured. Returns false only when a provider IS
 * configured but verification fails — that way enabling captcha on a
 * form is a real protection, while leaving the env var blank keeps
 * the endpoint useful.
 */
export async function verifyCaptcha(config: CaptchaConfig): Promise<boolean> {
  if (!isCaptchaConfigured()) {
    return true;
  }

  if (!config.token) {
    return false;
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    return verifyAgainst(TURNSTILE_ENDPOINT, turnstileSecret, config);
  }

  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
  if (recaptchaSecret) {
    return verifyAgainst(RECAPTCHA_ENDPOINT, recaptchaSecret, config);
  }

  return true;
}

async function verifyAgainst(
  url: string,
  secret: string,
  config: CaptchaConfig,
): Promise<boolean> {
  try {
    const params = new URLSearchParams();
    params.set('secret', secret);
    params.set('response', config.token ?? '');
    if (config.remoteIp) {
      params.set('remoteip', config.remoteIp);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch (err) {
    console.error('captcha verification failed', err);
    return false;
  }
}
