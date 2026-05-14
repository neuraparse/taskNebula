/**
 * Slack integration helpers.
 *
 * Mirrors the shape of the GitHub / Sentry helpers in this directory:
 *   - exports the provider constant + state cookie name,
 *   - resolves OAuth client credentials (DB then env),
 *   - builds the v2 authorize URL with the documented bot scopes,
 *   - exchanges the OAuth code for tokens, and
 *   - provides primitives the slash-command and Events API routes need:
 *       * verifySlackSignature  — HMAC-SHA256 over the raw body using the
 *         signing secret, with a 5-minute timestamp window to reject replays.
 *       * parseSlashCommand     — turns "/tn assign TN-123 @alice" into a
 *         typed `{ verb, args }` so route handlers stay declarative.
 *       * callSlackApi          — thin Web API caller that decrypts the bot
 *         token off the integration_connections row before calling Slack.
 *
 * Docs:
 *   https://api.slack.com/authentication/verifying-requests-from-slack
 *   https://api.slack.com/interactivity/slash-commands
 *   https://api.slack.com/methods/oauth.v2.access
 */

import crypto from 'crypto';
import { getClientCredentials } from './client-credentials';
import {
  asTokenEnvelope,
  decryptToken,
  type TokenEnvelope,
} from './token-crypto';

export const SLACK_PROVIDER = 'slack';
export const SLACK_STATE_COOKIE = 'tn_slack_state';

// Scopes documented in the roadmap task. `commands` is required for the slash
// command, `chat:write` for thread replies and modals, `reactions:read` for
// emoji-triage, `app_mentions:read` so the bot can react to @mentions in
// channels, `channels:read` + `users:read` for the channel/user resolvers.
export const SLACK_DEFAULT_SCOPES =
  'commands,chat:write,reactions:read,app_mentions:read,channels:read,users:read';

export const SLACK_AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
export const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
export const SLACK_API_BASE = 'https://slack.com/api';

// Maximum age of a request signed by Slack we'll accept (Slack docs recommend
// rejecting timestamps older than 5 minutes to mitigate replay attacks).
const SLACK_SIGNATURE_MAX_AGE_SECONDS = 60 * 5;

export type SlackOauthAccessResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id?: string; name?: string };
  enterprise?: { id?: string; name?: string } | null;
  authed_user?: { id?: string; access_token?: string; scope?: string };
  expires_in?: number;
};

type ResolvedSlackCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
};

function defaultSlackRedirectUri(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/integrations/slack/callback`;
}

export async function getSlackClientCredentials(): Promise<ResolvedSlackCredentials> {
  const credentials = await getClientCredentials('slack');
  if (!credentials) {
    throw new Error(
      'Slack integration is not configured. Add credentials in Admin → Integrations, or set SLACK_CLIENT_ID / SLACK_CLIENT_SECRET.'
    );
  }
  return {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: credentials.redirectUri ?? defaultSlackRedirectUri(),
    scope: credentials.scope ?? SLACK_DEFAULT_SCOPES,
  };
}

export async function buildSlackAuthorizeUrl(params: {
  state: string;
}): Promise<string> {
  const { clientId, redirectUri, scope } = await getSlackClientCredentials();
  const url = new URL(SLACK_AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  // Slack expects comma-separated scopes here (no spaces).
  url.searchParams.set('scope', scope.replace(/\s+/g, ','));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', params.state);
  return url.toString();
}

export async function exchangeSlackCode(
  code: string
): Promise<SlackOauthAccessResponse> {
  const { clientId, clientSecret, redirectUri } =
    await getSlackClientCredentials();
  const response = await fetch(SLACK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
    cache: 'no-store',
  });
  return (await response.json()) as SlackOauthAccessResponse;
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

export interface SlackSignatureInput {
  /** Raw request body — must be the bytes Slack signed, not a re-serialization. */
  body: string;
  /** Value of the `X-Slack-Request-Timestamp` header. */
  timestamp: string | null;
  /** Value of the `X-Slack-Signature` header (format `v0=<hex>`). */
  signature: string | null;
  /** Signing secret resolved from `SLACK_SIGNING_SECRET` env var. */
  signingSecret: string;
  /** Override "now" in seconds — used only by tests. */
  nowSeconds?: number;
}

/**
 * Constant-time HMAC-SHA256 check of an incoming Slack request.
 *
 * Returns `true` only when:
 *   1. timestamp + signature headers are present and well-formed,
 *   2. the timestamp is within the 5-minute replay window, and
 *   3. `v0=<hmac>` matches HMAC-SHA256("v0:<ts>:<body>") under the secret.
 */
export function verifySlackSignature(input: SlackSignatureInput): boolean {
  const { body, timestamp, signature, signingSecret } = input;
  if (!timestamp || !signature || !signingSecret) return false;

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > SLACK_SIGNATURE_MAX_AGE_SECONDS) return false;

  const base = `v0:${timestamp}:${body}`;
  const expected = `v0=${crypto
    .createHmac('sha256', signingSecret)
    .update(base)
    .digest('hex')}`;

  // crypto.timingSafeEqual throws if the buffers differ in length, so we
  // size-check first to short-circuit cleanly.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getSlackSigningSecret(): string | null {
  const value = process.env.SLACK_SIGNING_SECRET;
  return value && value.length > 0 ? value : null;
}

// ---------------------------------------------------------------------------
// Slash command parser
// ---------------------------------------------------------------------------

export type SlackSlashVerb =
  | 'new'
  | 'list'
  | 'search'
  | 'assign'
  | 'status'
  | 'help'
  | 'unknown';

export interface ParsedSlashCommand {
  verb: SlackSlashVerb;
  /** Tokenized arguments after the verb, whitespace-split, quotes preserved. */
  args: string[];
  /** Raw arguments joined with single spaces (handy for free-text verbs). */
  raw: string;
}

const KNOWN_VERBS: ReadonlySet<SlackSlashVerb> = new Set([
  'new',
  'list',
  'search',
  'assign',
  'status',
  'help',
]);

/**
 * Parse the `text` field Slack sends with a slash command into a typed verb +
 * argument list. Empty input is treated as `help`, unrecognized verbs are
 * surfaced explicitly so callers can show a usage hint rather than 500.
 *
 * The parser is intentionally permissive: it preserves quoted phrases as a
 * single token but does not try to evaluate flags — Slack users overwhelmingly
 * use positional arguments.
 */
export function parseSlashCommand(text: string | null | undefined): ParsedSlashCommand {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { verb: 'help', args: [], raw: '' };

  const tokens = tokenize(trimmed);
  const head = tokens.shift() ?? '';
  const verbCandidate = head.toLowerCase() as SlackSlashVerb;
  const verb: SlackSlashVerb = KNOWN_VERBS.has(verbCandidate)
    ? verbCandidate
    : 'unknown';

  return {
    verb,
    args: tokens,
    raw: tokens.join(' '),
  };
}

/**
 * Split a Slack slash command argument string into tokens while keeping
 * "double quoted" phrases together. We deliberately keep this simple — full
 * shell-style parsing is overkill for `/tn new "title with spaces"`.
 */
function tokenize(input: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(ch ?? '')) {
      if (buf.length > 0) {
        out.push(buf);
        buf = '';
      }
      continue;
    }
    buf += ch;
  }
  if (buf.length > 0) out.push(buf);
  return out;
}

/**
 * Pull a Slack `<@U01234567|alice>` or `@alice` mention out of an arg list
 * and return the bare user id (or null when no mention shape matches).
 */
export function parseSlackUserMention(input: string | undefined): string | null {
  if (!input) return null;
  // <@U01234567> or <@U01234567|display>
  const m = input.match(/^<@([A-Z0-9]+)(\|[^>]*)?>$/);
  if (m) return m[1] ?? null;
  // bare U01234567
  if (/^U[A-Z0-9]{6,}$/.test(input)) return input;
  return null;
}

// ---------------------------------------------------------------------------
// Slack Web API caller
// ---------------------------------------------------------------------------

export interface SlackApiResponse<T> {
  ok: boolean;
  error?: string;
  data?: T;
}

/**
 * Decrypt the bot token off an integration_connections row and call a Slack
 * Web API method with the JSON Content-Type. Returns a typed envelope so
 * callers can branch on `ok` without re-implementing error handling.
 */
export async function callSlackApi<T = Record<string, unknown>>(
  method: string,
  accessTokenEnc: unknown,
  body: Record<string, unknown>
): Promise<SlackApiResponse<T>> {
  const envelope = asTokenEnvelope(accessTokenEnc);
  if (!envelope) {
    return { ok: false, error: 'missing_token' };
  }
  let token: string;
  try {
    token = decryptToken(envelope);
  } catch {
    return { ok: false, error: 'token_decrypt_failed' };
  }
  try {
    const response = await fetch(`${SLACK_API_BASE}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const json = (await response.json()) as Record<string, unknown>;
    if (json.ok === true) {
      return { ok: true, data: json as T };
    }
    return {
      ok: false,
      error: (json.error as string) || `http_${response.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'fetch_failed',
    };
  }
}

/**
 * Post a message to a channel — typically the bot's confirmation reply in a
 * thread. `thread_ts` is preserved verbatim so callers can mirror comments.
 */
export async function postSlackMessage(
  accessTokenEnc: unknown,
  params: {
    channel: string;
    text: string;
    threadTs?: string | null;
    blocks?: unknown[];
  }
): Promise<SlackApiResponse<{ ts: string; channel: string }>> {
  return callSlackApi('chat.postMessage', accessTokenEnc, {
    channel: params.channel,
    text: params.text,
    thread_ts: params.threadTs ?? undefined,
    blocks: params.blocks,
  });
}

/**
 * Convenience: convert an unknown envelope blob into the plaintext bot token
 * so callers that need to hit Slack APIs directly can keep their code small.
 * Returns null on any failure path — caller decides how to surface the error.
 */
export function decryptSlackTokenSafe(envelope: unknown): string | null {
  const e = asTokenEnvelope(envelope);
  if (!e) return null;
  try {
    return decryptToken(e);
  } catch {
    return null;
  }
}

export type { TokenEnvelope };
