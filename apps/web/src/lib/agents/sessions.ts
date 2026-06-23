/**
 * Linear Agent Protocol — session lifecycle helpers (P0-04).
 *
 * Provides:
 *   - `AgentSessionEventSchema` — Zod schema matching Linear's AgentSessionEvent
 *     wire format, plus a couple of TaskNebula-specific fields.
 *   - `nextSessionState(...)` — pure state machine; rejects invalid transitions
 *     so a misbehaving provider can't drag a session from `complete` back to
 *     `active` without us noticing.
 *   - `signAgentPayload` / `verifyAgentSignature` — HMAC-SHA256 helpers that
 *     mirror `signWebhookPayload` from the webhook dispatcher. The same wire
 *     format is used in both directions so receivers and senders share one
 *     primitive.
 *   - `generateAgentSecret` / `generateDeliveryId` — small wrappers around
 *     `crypto.randomBytes` so call sites don't sprinkle their own.
 *
 * All exports are pure or crypto-only — no DB or network — so they can be
 * exercised by the jest suite without mocking the world.
 */

import crypto from 'crypto';
import { z } from 'zod';

// --- types -----------------------------------------------------------------

export type AgentProviderKind =
  | 'claude'
  | 'codex'
  | 'cursor'
  | 'devin'
  | 'copilot'
  | 'openhands'
  | 'custom';

export const AGENT_PROVIDERS: readonly AgentProviderKind[] = [
  'claude',
  'codex',
  'cursor',
  'devin',
  'copilot',
  'openhands',
  'custom',
] as const;

export type AgentSessionState =
  | 'pending'
  | 'active'
  | 'awaitingInput'
  | 'error'
  | 'complete'
  | 'stale';

export const AGENT_SESSION_STATES: readonly AgentSessionState[] = [
  'pending',
  'active',
  'awaitingInput',
  'error',
  'complete',
  'stale',
] as const;

/**
 * Allowed transitions. We follow Linear's documented lifecycle:
 *
 *   pending -> active | error | stale
 *   active  -> awaitingInput | complete | error | stale
 *   awaitingInput -> active | complete | error | stale
 *   error   -> (terminal)  // provider must dispatch a new session to retry
 *   complete -> (terminal)
 *   stale   -> active      // provider can resume a stale session
 *
 * Anything else is dropped on the floor (and logged at the call site).
 */
const TRANSITIONS: Record<AgentSessionState, readonly AgentSessionState[]> = {
  pending: ['active', 'error', 'stale'],
  active: ['awaitingInput', 'complete', 'error', 'stale'],
  awaitingInput: ['active', 'complete', 'error', 'stale'],
  error: [],
  complete: [],
  stale: ['active'],
};

export function canTransition(from: AgentSessionState, to: AgentSessionState): boolean {
  if (from === to) return true; // idempotent re-deliveries are fine
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Pure state machine reducer. Returns the new state or `null` if the
 * transition is invalid. Callers should treat `null` as a no-op (we log it
 * once at the route, but never throw).
 */
export function nextSessionState(
  current: AgentSessionState,
  next: AgentSessionState
): AgentSessionState | null {
  return canTransition(current, next) ? next : null;
}

export function isTerminalState(state: AgentSessionState): boolean {
  return state === 'complete' || state === 'error';
}

// --- AgentSessionEvent payload schema --------------------------------------

/**
 * Linear-compatible AgentSessionEvent. We keep the shape close to upstream so a
 * provider can speak both Linear and TaskNebula without forking its emitter.
 *
 * Required: `state`. Everything else is optional — providers send what they
 * have at each phase of the session.
 */
export const AgentSessionEventSchema = z.object({
  state: z.enum(AGENT_SESSION_STATES as readonly [AgentSessionState, ...AgentSessionState[]]),
  sessionId: z.string().min(1).optional(),
  externalId: z.string().min(1).optional(),
  message: z.string().max(8000).optional(),
  prompt: z.string().max(16000).optional(),
  // Repository / PR / branch references the provider is touching.
  repo: z
    .object({
      owner: z.string().optional(),
      name: z.string().optional(),
      branch: z.string().optional(),
      headSha: z.string().optional(),
    })
    .optional(),
  pullRequest: z
    .object({
      url: z.string().url().optional(),
      number: z.number().int().optional(),
      title: z.string().optional(),
      state: z.string().optional(),
    })
    .optional(),
  // Free-form provider extras (token usage, cost, etc.).
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().optional(),
});

export type AgentSessionEvent = z.infer<typeof AgentSessionEventSchema>;

/**
 * AgentSessionRequest — what we POST to the provider when dispatching. We
 * include enough context that a fresh worker can boot, do the work, and post
 * back. Keep the field names stable; downstream providers code against them.
 */
export interface AgentSessionRequest {
  // Stable session identifier (our `agent_sessions.id`). Echo back in events.
  sessionId: string;
  // TaskNebula issue snapshot.
  issue: {
    id: string;
    key: string;
    title: string;
    description: string | null;
    priority: string;
    labels: unknown;
    projectId: string;
    organizationId: string;
    url: string;
  };
  // Caller user id (the human who hit dispatch). Optional — automations may
  // dispatch without a user.
  actorUserId: string | null;
  // Optional per-dispatch override of the system prompt.
  promptOverride: string | null;
  // Caller-supplied repo metadata when known (sourced from project settings).
  repo?: {
    owner?: string;
    name?: string;
    branch?: string;
  };
  // Reply webhook the provider must POST AgentSessionEvent to.
  callbackUrl: string;
  // Timestamp of dispatch.
  dispatchedAt: string;
}

// --- HMAC helpers ----------------------------------------------------------

/**
 * Sign a serialized payload with HMAC-SHA256. Identical primitive to
 * `signWebhookPayload` so receivers can reuse the same verifier across
 * TaskNebula's outbound webhook flows.
 */
export function signAgentPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify an incoming signature header in constant time. Accepts either
 * `sha256=<hex>` or bare `<hex>` formats (Linear sends the prefixed form,
 * some self-hosted providers don't).
 */
export function verifyAgentSignature(
  payload: string,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader;
  const expected = signAgentPayload(payload, secret);
  // Both buffers must have the same length for timingSafeEqual.
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function generateAgentSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateDeliveryId(): string {
  return crypto.randomBytes(12).toString('hex');
}

// --- comment formatting ----------------------------------------------------

/**
 * Render a short human-readable comment line for a session event so we can
 * post it to the issue thread ("Cursor started", "Devin completed PR #42").
 * The state-machine view stays in the side panel.
 */
export function renderAgentComment(
  provider: AgentProviderKind,
  state: AgentSessionState,
  event: AgentSessionEvent
): string {
  const label =
    provider === 'claude'
      ? 'Claude'
      : provider === 'codex'
        ? 'Codex'
        : provider === 'cursor'
          ? 'Cursor'
          : provider === 'devin'
            ? 'Devin'
            : provider === 'copilot'
              ? 'Copilot'
              : provider === 'openhands'
                ? 'OpenHands'
                : 'Agent';

  const pr = event.pullRequest;
  switch (state) {
    case 'pending':
      return `${label} session queued.`;
    case 'active':
      return event.message ? `${label} started: ${event.message}` : `${label} started.`;
    case 'awaitingInput':
      return event.message
        ? `${label} is awaiting input: ${event.message}`
        : `${label} is awaiting input.`;
    case 'complete':
      if (pr?.url && pr?.number) {
        return `${label} completed — [PR #${pr.number}](${pr.url})${pr.title ? ` — ${pr.title}` : ''}`;
      }
      if (event.message) return `${label} completed: ${event.message}`;
      return `${label} completed.`;
    case 'error':
      return event.message ? `${label} errored: ${event.message}` : `${label} errored.`;
    case 'stale':
      return `${label} session went stale.`;
    default:
      return `${label} updated.`;
  }
}
