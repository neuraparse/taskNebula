/**
 * Langfuse LLM observability shim (OBS-35).
 *
 * One job: take a finished LLM call and ship it to Langfuse with the right
 * metadata + token math so the operator gets per-feature cost & latency
 * dashboards without each call-site having to know the Langfuse SDK.
 *
 * Activation
 * ----------
 * Both `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` must be set. If either
 * is missing this module short-circuits — that means tests and local dev
 * (where you usually have no Langfuse project) stay fast and side-effect-free.
 * `LANGFUSE_HOST` defaults to https://cloud.langfuse.com but can point to a
 * self-hosted instance.
 *
 * Trace correlation
 * -----------------
 * Whenever an OpenTelemetry span is active we tag the Langfuse trace with the
 * trace + span IDs from the OTel context. Combined with `service.name=tasknebula-web`
 * this lets operators jump from a SigNoz/Grafana trace straight to the
 * Langfuse generation that the span wrapped.
 */

import { trace, type Span } from '@opentelemetry/api';

export type TraceLlmCallInput = {
  /** Stable feature slug, e.g. "issue.draft" — Langfuse uses this for filters & dashboards. */
  feature: string;
  /** LLM provider, e.g. "openai" | "anthropic" | "native". */
  provider: string;
  /** Model identifier (e.g. "gpt-4o-mini", "claude-sonnet-4-6"). */
  model: string;
  /** Prompt or structured input sent to the model. */
  input: unknown;
  /** Model output (string, JSON, or error message). */
  output: unknown;
  /** Wall-clock duration in milliseconds. */
  latencyMs: number;
  /** Best-known token counts. Pass undefined fields when the provider didn't return them. */
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  /** Surrogate user id from the session — Langfuse aggregates per user. */
  userId?: string;
  /** Workspace / organization scoping. */
  organizationId?: string;
  /** Optional error string captured when the LLM failed. */
  errorMessage?: string;
  /** Arbitrary additional metadata. */
  metadata?: Record<string, unknown>;
};

type LangfuseClient = {
  trace: (args: Record<string, unknown>) => {
    generation: (args: Record<string, unknown>) => unknown;
  };
  flushAsync: () => Promise<unknown>;
};

let cachedClient: LangfuseClient | null | undefined;

function isEnabled(): boolean {
  return Boolean(
    process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
  );
}

async function getClient(): Promise<LangfuseClient | null> {
  if (cachedClient !== undefined) return cachedClient;
  if (!isEnabled()) {
    cachedClient = null;
    return cachedClient;
  }
  try {
    const mod = (await import('langfuse')) as unknown as {
      Langfuse: new (config: Record<string, unknown>) => LangfuseClient;
    };
    cachedClient = new mod.Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    });
    return cachedClient;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[langfuse] SDK unavailable — skipping LLM tracing:', err);
    cachedClient = null;
    return cachedClient;
  }
}

function spanContext(): { traceId?: string; spanId?: string } {
  try {
    const active: Span | undefined = trace.getActiveSpan();
    if (!active) return {};
    const ctx = active.spanContext();
    return { traceId: ctx.traceId, spanId: ctx.spanId };
  } catch {
    return {};
  }
}

/**
 * Send a completed LLM call to Langfuse. Always returns — never throws —
 * so an observability outage cannot break the AI feature itself.
 *
 * Side effect: when `LANGFUSE_PUBLIC_KEY` is unset, this is a no-op that
 * resolves immediately. Tests rely on that to assert "the engine ran but no
 * trace was emitted".
 */
export async function traceLlmCall(input: TraceLlmCallInput): Promise<void> {
  if (!isEnabled()) return;

  const client = await getClient();
  if (!client) return;

  const { traceId, spanId } = spanContext();
  const startTime = new Date(Date.now() - Math.max(0, input.latencyMs));
  const endTime = new Date();

  try {
    const tr = client.trace({
      name: input.feature,
      userId: input.userId,
      metadata: {
        provider: input.provider,
        organizationId: input.organizationId,
        otelTraceId: traceId,
        otelSpanId: spanId,
        ...(input.metadata ?? {}),
      },
      tags: [
        `feature:${input.feature}`,
        `provider:${input.provider}`,
        `model:${input.model}`,
      ],
    });

    tr.generation({
      name: `${input.feature}.generation`,
      model: input.model,
      modelParameters: { provider: input.provider },
      input: input.input,
      output: input.errorMessage ? { error: input.errorMessage } : input.output,
      startTime,
      endTime,
      usage: input.tokens
        ? {
            input: input.tokens.prompt,
            output: input.tokens.completion,
            total: input.tokens.total,
          }
        : undefined,
      level: input.errorMessage ? 'ERROR' : 'DEFAULT',
      statusMessage: input.errorMessage,
    });

    // fire-and-forget flush so the Lambda/edge runtime ships the event
    // before the request finishes. Ignore the result — failures are logged
    // inside the SDK.
    await client.flushAsync().catch(() => {});
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[langfuse] traceLlmCall failed:', err);
  }
}

/**
 * Test-only helper: clears the cached client so a fresh `getClient()` runs
 * after env vars are set/unset within a test.
 */
export function _resetLangfuseClientForTests() {
  cachedClient = undefined;
}
