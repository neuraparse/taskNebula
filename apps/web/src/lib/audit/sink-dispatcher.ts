/**
 * Audit log sink dispatcher — fan-out an audit_logs row to every enabled
 * SIEM destination configured for the workspace.
 *
 * Designed to be fire-and-forget: callers should invoke
 * `void dispatchAuditLogToSinks(...)` — the function never throws and never
 * rejects. One bad sink does not affect the others (each is awaited
 * independently inside a try/catch). Failure counters and last_error are
 * persisted so operators can see issues in the UI without reading logs.
 *
 * Sink types (config jsonb shape):
 *   - webhook:    { url: string }                       (HMAC over body via signing_secret)
 *   - splunk_hec: { url: string, token: string }        (Authorization: Splunk <token>)
 *   - datadog:    { apiKey: string, site?: string }     (DD-API-KEY header)
 *   - s3:         { bucket: string, region: string, prefix?: string }
 *                 (env-gated: requires AWS_ACCESS_KEY_ID/SECRET in env;
 *                  appends a JSONL object keyed by ISO date.)
 *
 * Replay protection: every outgoing HTTP request carries an `X-TaskNebula-Nonce`
 * header (random 16-byte hex) plus a `timestamp` field inside the envelope —
 * receivers can reject requests with stale timestamps or repeated nonces.
 */

import crypto from 'crypto';
import { db, auditLogSinks, eq, and } from '@tasknebula/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SinkType = 'webhook' | 'splunk_hec' | 'datadog' | 's3';

export interface AuditLogEvent {
  id: string;
  workspaceId: string; // organizationId
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  projectId?: string | null;
  issueId?: string | null;
  changes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string; // ISO timestamp
}

export interface SinkDispatchResult {
  sinkId: string;
  type: SinkType;
  ok: boolean;
  statusCode: number | null;
  durationMs: number;
  error: string | null;
}

interface SinkRow {
  id: string;
  workspaceId: string;
  type: SinkType;
  name: string;
  config: Record<string, unknown>;
  signingSecret: string;
  successCount: string;
  failureCount: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Signing primitive (re-used by tests + receivers)
// ---------------------------------------------------------------------------

export function signSinkPayload(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// ---------------------------------------------------------------------------
// Per-type delivery
// ---------------------------------------------------------------------------

interface DeliveryAttempt {
  ok: boolean;
  statusCode: number | null;
  error: string | null;
  durationMs: number;
}

async function timedFetch(
  url: string,
  init: RequestInit
): Promise<DeliveryAttempt> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return {
      ok: response.ok,
      statusCode: response.status,
      error: response.ok ? null : `HTTP ${response.status}`,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : err.message
        : String(err);
    return {
      ok: false,
      statusCode: null,
      error: message,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function deliverWebhook(
  sink: SinkRow,
  event: AuditLogEvent,
  nonce: string
): Promise<DeliveryAttempt> {
  const config = sink.config as { url?: string };
  if (!config.url) {
    return { ok: false, statusCode: null, error: 'missing config.url', durationMs: 0 };
  }
  const body = JSON.stringify({ ...event, nonce, timestamp: event.createdAt });
  const signature = signSinkPayload(body, sink.signingSecret);
  return timedFetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-TaskNebula-Event': `audit.${event.action}`,
      'X-TaskNebula-Signature': `sha256=${signature}`,
      'X-TaskNebula-Nonce': nonce,
      'X-TaskNebula-Sink-Id': sink.id,
    },
    body,
  });
}

async function deliverSplunk(
  sink: SinkRow,
  event: AuditLogEvent,
  nonce: string
): Promise<DeliveryAttempt> {
  const config = sink.config as { url?: string; token?: string; index?: string };
  if (!config.url || !config.token) {
    return {
      ok: false,
      statusCode: null,
      error: 'missing config.url or config.token',
      durationMs: 0,
    };
  }
  // Splunk HEC expects { event: {...}, time: epoch_seconds, sourcetype, index? }
  const epochSeconds = Math.floor(new Date(event.createdAt).getTime() / 1000);
  const body = JSON.stringify({
    time: epochSeconds,
    sourcetype: 'tasknebula:audit',
    source: 'tasknebula',
    index: config.index,
    event: { ...event, nonce },
  });
  return timedFetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Splunk ${config.token}`,
      'X-TaskNebula-Nonce': nonce,
    },
    body,
  });
}

async function deliverDatadog(
  sink: SinkRow,
  event: AuditLogEvent,
  nonce: string
): Promise<DeliveryAttempt> {
  const config = sink.config as { apiKey?: string; site?: string };
  if (!config.apiKey) {
    return {
      ok: false,
      statusCode: null,
      error: 'missing config.apiKey',
      durationMs: 0,
    };
  }
  const site = config.site || 'datadoghq.com';
  const url = `https://http-intake.logs.${site}/api/v2/logs`;
  const body = JSON.stringify([
    {
      ddsource: 'tasknebula',
      service: 'tasknebula-audit',
      ddtags: `workspace:${event.workspaceId},action:${event.action}`,
      hostname: 'tasknebula',
      message: JSON.stringify({ ...event, nonce }),
    },
  ]);
  return timedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': config.apiKey,
      'X-TaskNebula-Nonce': nonce,
    },
    body,
  });
}

/**
 * Append to S3 as JSONL by date. Requires AWS_ACCESS_KEY_ID +
 * AWS_SECRET_ACCESS_KEY in env, AND the `@aws-sdk/client-s3` package to be
 * installed. We import lazily so the rest of the audit pipeline runs even
 * when AWS bits are not configured (the call simply returns a soft error).
 *
 * Because S3 has no native append, we put a per-event object under
 * `<prefix>/<workspaceId>/<YYYY-MM-DD>/<eventId>.json`. Operators who want
 * a true daily JSONL file should run a Lambda compactor on top.
 */
async function deliverS3(
  sink: SinkRow,
  event: AuditLogEvent
): Promise<DeliveryAttempt> {
  const startedAt = Date.now();
  const config = sink.config as {
    bucket?: string;
    region?: string;
    prefix?: string;
  };
  if (!config.bucket || !config.region) {
    return {
      ok: false,
      statusCode: null,
      error: 'missing config.bucket or config.region',
      durationMs: 0,
    };
  }
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      ok: false,
      statusCode: null,
      error: 'AWS credentials not configured (AWS_ACCESS_KEY_ID/SECRET)',
      durationMs: Date.now() - startedAt,
    };
  }
  try {
    // Lazy import so the SDK is only required when the sink is actually used.
    // Typed as `unknown` because the package is optional and not declared in
    // package.json — installs are expected to add `@aws-sdk/client-s3` when
    // enabling the s3 sink. We narrow with runtime checks below.
    const sdkModule = (await import(
      /* webpackIgnore: true */ '@aws-sdk/client-s3' as string
    )) as unknown as {
      S3Client: new (cfg: { region: string }) => {
        send: (cmd: unknown) => Promise<unknown>;
      };
      PutObjectCommand: new (input: {
        Bucket: string;
        Key: string;
        Body: string;
        ContentType: string;
      }) => unknown;
    };
    const client = new sdkModule.S3Client({ region: config.region });
    const date = event.createdAt.slice(0, 10); // YYYY-MM-DD
    const prefix = (config.prefix || 'tasknebula-audit').replace(/\/$/, '');
    const key = `${prefix}/${event.workspaceId}/${date}/${event.id}.json`;
    await client.send(
      new sdkModule.PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: JSON.stringify(event) + '\n',
        ContentType: 'application/x-ndjson',
      })
    );
    return {
      ok: true,
      statusCode: 200,
      error: null,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Single-sink dispatch + bookkeeping
// ---------------------------------------------------------------------------

export async function deliverToSink(
  sink: SinkRow,
  event: AuditLogEvent
): Promise<SinkDispatchResult> {
  const nonce = crypto.randomBytes(16).toString('hex');
  let attempt: DeliveryAttempt;
  switch (sink.type) {
    case 'webhook':
      attempt = await deliverWebhook(sink, event, nonce);
      break;
    case 'splunk_hec':
      attempt = await deliverSplunk(sink, event, nonce);
      break;
    case 'datadog':
      attempt = await deliverDatadog(sink, event, nonce);
      break;
    case 's3':
      attempt = await deliverS3(sink, event);
      break;
    default:
      attempt = {
        ok: false,
        statusCode: null,
        error: `unknown sink type: ${String(sink.type)}`,
        durationMs: 0,
      };
  }
  return {
    sinkId: sink.id,
    type: sink.type,
    ok: attempt.ok,
    statusCode: attempt.statusCode,
    durationMs: attempt.durationMs,
    error: attempt.error,
  };
}

async function recordOutcome(
  sink: SinkRow,
  result: SinkDispatchResult
): Promise<void> {
  try {
    const successCount =
      Number.parseInt(sink.successCount || '0', 10) + (result.ok ? 1 : 0);
    const failureCount =
      Number.parseInt(sink.failureCount || '0', 10) + (result.ok ? 0 : 1);
    await db
      .update(auditLogSinks)
      .set({
        successCount: String(successCount),
        failureCount: String(failureCount),
        lastDeliveryAt: new Date(),
        lastError: result.ok ? null : result.error,
        updatedAt: new Date(),
      })
      .where(eq(auditLogSinks.id, sink.id));
  } catch (err) {
    console.error('[audit-sink] failed to record outcome', {
      sinkId: sink.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

async function loadEnabledSinks(workspaceId: string): Promise<SinkRow[]> {
  const rows = await db
    .select({
      id: auditLogSinks.id,
      workspaceId: auditLogSinks.workspaceId,
      type: auditLogSinks.type,
      name: auditLogSinks.name,
      config: auditLogSinks.config,
      signingSecret: auditLogSinks.signingSecret,
      successCount: auditLogSinks.successCount,
      failureCount: auditLogSinks.failureCount,
    })
    .from(auditLogSinks)
    .where(
      and(
        eq(auditLogSinks.workspaceId, workspaceId),
        eq(auditLogSinks.enabled, true)
      )
    );
  return rows.map((row) => ({
    ...row,
    type: row.type as SinkType,
    config: (row.config as Record<string, unknown>) ?? {},
  }));
}

/**
 * Fan-out an audit log event to every enabled sink for its workspace.
 *
 * Safety:
 *   - Never throws — always resolves with a result list (possibly empty).
 *   - Per-sink failures are isolated — one timeout does not block the others.
 *   - Bookkeeping (success_count, failure_count, last_error) is best-effort
 *     and never blocks the main response.
 */
export async function dispatchAuditLogToSinks(
  event: AuditLogEvent
): Promise<SinkDispatchResult[]> {
  let sinks: SinkRow[];
  try {
    sinks = await loadEnabledSinks(event.workspaceId);
  } catch (err) {
    console.error('[audit-sink] failed to load sinks', {
      workspaceId: event.workspaceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
  if (sinks.length === 0) return [];

  const results = await Promise.all(
    sinks.map(async (sink) => {
      try {
        const result = await deliverToSink(sink, event);
        await recordOutcome(sink, result);
        return result;
      } catch (err) {
        const errorResult: SinkDispatchResult = {
          sinkId: sink.id,
          type: sink.type,
          ok: false,
          statusCode: null,
          durationMs: 0,
          error: err instanceof Error ? err.message : String(err),
        };
        // Best-effort: do not let a bookkeeping failure mask the error.
        await recordOutcome(sink, errorResult).catch(() => undefined);
        return errorResult;
      }
    })
  );
  return results;
}
