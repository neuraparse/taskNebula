/**
 * OpenAI Batch API wrapper.
 *
 * The Batch API processes requests asynchronously within 24 hours at ~50%
 * of the synchronous price. We route the following non-realtime workloads
 * through it:
 *
 *   - Embedding backfill jobs
 *   - Weekly summary agent
 *   - Stale-issue janitor sweep
 *   - Release notes generation
 *   - Triage suggestion backfill
 *
 * Realtime endpoints (chat, draft-issue, issue-assist) keep using the
 * standard sync endpoint because their latency budget is seconds, not
 * hours.
 *
 * Flow:
 *   1. `submitBatchJob(requests)` uploads a JSONL file with one
 *      `/v1/chat/completions` (or `/v1/embeddings`) request per line,
 *      creates an OpenAI batch, and inserts a row into `llm_batch_jobs`.
 *   2. A cron polls `pollBatch(batchId)` to refresh status/progress.
 *   3. Once `completed`, `fetchBatchResults(batchId)` downloads the output
 *      JSONL and returns the parsed rows. The storage path is recorded in
 *      `llm_batch_jobs.results_storage_path` for later replay.
 *
 * All persistence goes through `@tasknebula/db`.
 */

import { db, eq, llmBatchJobs } from '@tasknebula/db';

export type BatchWorkload =
  | 'embedding_backfill'
  | 'weekly_summary'
  | 'stale_janitor'
  | 'release_notes'
  | 'triage_backfill'
  | 'other';

/**
 * One request line in the JSONL upload. `url` is the endpoint that OpenAI
 * will hit when the batch runs (e.g. `/v1/chat/completions`).
 */
export interface BatchRequestLine {
  custom_id: string;
  method: 'POST';
  url: string;
  body: Record<string, unknown>;
}

export interface SubmitBatchOptions {
  workload: BatchWorkload;
  organizationId?: string | null;
  /** Endpoint passed through to OpenAI; defaults to chat completions. */
  endpoint?: '/v1/chat/completions' | '/v1/embeddings' | '/v1/completions';
  /** Completion window. Only `24h` is currently supported by the API. */
  completionWindow?: '24h';
  apiKey?: string;
  metadata?: Record<string, unknown>;
}

export interface SubmitBatchResult {
  /** TaskNebula-side `llm_batch_jobs.id`. */
  id: string;
  /** Upstream OpenAI batch id (e.g. `batch_abc123`). */
  externalBatchId: string;
  status: string;
  totalRequests: number;
}

export interface BatchStatus {
  id: string;
  externalBatchId: string;
  status: string;
  totalRequests: number;
  completedRequests: number;
  errorCount: number;
  workload: string;
  resultsStoragePath: string | null;
  completedAt: Date | null;
}

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

class BatchError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = 'BatchError';
    this.code = code;
    this.status = status;
  }
}

function getApiKey(explicit?: string): string {
  const key = explicit || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new BatchError(
      'missing_credential',
      'OPENAI_API_KEY is not configured; cannot submit Batch API jobs.',
      503
    );
  }
  return key;
}

function toJsonl(requests: BatchRequestLine[]): string {
  return requests.map((line) => JSON.stringify(line)).join('\n') + '\n';
}

/**
 * Upload a JSONL file to OpenAI's Files API with purpose=batch.
 * Returns the uploaded file id.
 */
async function uploadBatchFile(apiKey: string, jsonl: string): Promise<string> {
  const form = new FormData();
  // Blob is available globally in Node 20+ and the Edge runtime.
  const blob = new Blob([jsonl], { type: 'application/jsonl' });
  form.append('purpose', 'batch');
  form.append('file', blob, 'tasknebula-batch.jsonl');

  const res = await fetch(`${OPENAI_BASE_URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new BatchError(
      'file_upload_failed',
      `OpenAI file upload failed (${res.status}): ${detail.slice(0, 300)}`,
      502
    );
  }
  const payload = (await res.json()) as { id?: string };
  if (!payload.id) {
    throw new BatchError('file_upload_failed', 'OpenAI file upload returned no id.', 502);
  }
  return payload.id;
}

/**
 * Create an OpenAI batch from a previously uploaded input file.
 */
async function createOpenAiBatch(
  apiKey: string,
  fileId: string,
  endpoint: string,
  completionWindow: string,
  metadata?: Record<string, unknown>
): Promise<{ id: string; status: string }> {
  const res = await fetch(`${OPENAI_BASE_URL}/batches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input_file_id: fileId,
      endpoint,
      completion_window: completionWindow,
      ...(metadata ? { metadata } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new BatchError(
      'batch_create_failed',
      `OpenAI batch create failed (${res.status}): ${detail.slice(0, 300)}`,
      502
    );
  }
  const payload = (await res.json()) as { id?: string; status?: string };
  if (!payload.id) {
    throw new BatchError('batch_create_failed', 'OpenAI batch create returned no id.', 502);
  }
  return { id: payload.id, status: payload.status || 'validating' };
}

/**
 * Submit a batch job. Persists a row in `llm_batch_jobs` and returns the
 * TaskNebula id + provider id.
 */
export async function submitBatchJob(
  requests: BatchRequestLine[],
  options: SubmitBatchOptions
): Promise<SubmitBatchResult> {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new BatchError('empty_batch', 'submitBatchJob requires at least one request.', 400);
  }

  const apiKey = getApiKey(options.apiKey);
  const endpoint = options.endpoint ?? '/v1/chat/completions';
  const completionWindow = options.completionWindow ?? '24h';

  const jsonl = toJsonl(requests);
  const fileId = await uploadBatchFile(apiKey, jsonl);
  const batch = await createOpenAiBatch(
    apiKey,
    fileId,
    endpoint,
    completionWindow,
    {
      workload: options.workload,
      ...(options.metadata ?? {}),
    }
  );

  const inserted = await db
    .insert(llmBatchJobs)
    .values({
      organizationId: options.organizationId ?? null,
      provider: 'openai',
      externalBatchId: batch.id,
      status: batch.status,
      workload: options.workload,
      totalRequests: requests.length,
      metadata: {
        endpoint,
        completionWindow,
        inputFileId: fileId,
        ...(options.metadata ?? {}),
      },
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    throw new BatchError('persist_failed', 'Failed to persist batch job row.', 500);
  }

  return {
    id: row.id,
    externalBatchId: batch.id,
    status: batch.status,
    totalRequests: requests.length,
  };
}

/**
 * Look up the TaskNebula batch row by its internal id.
 */
async function loadBatchRow(batchId: string) {
  const rows = await db
    .select()
    .from(llmBatchJobs)
    .where(eq(llmBatchJobs.id, batchId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new BatchError('not_found', `Batch job ${batchId} not found.`, 404);
  }
  return row;
}

/**
 * Refresh the status of a batch from OpenAI and persist updates.
 */
export async function pollBatch(batchId: string, apiKeyOverride?: string): Promise<BatchStatus> {
  const apiKey = getApiKey(apiKeyOverride);
  const row = await loadBatchRow(batchId);

  const res = await fetch(`${OPENAI_BASE_URL}/batches/${row.externalBatchId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new BatchError(
      'poll_failed',
      `OpenAI batch poll failed (${res.status}): ${detail.slice(0, 300)}`,
      502
    );
  }
  const payload = (await res.json()) as {
    id?: string;
    status?: string;
    request_counts?: { total?: number; completed?: number; failed?: number };
    output_file_id?: string | null;
    error_file_id?: string | null;
    completed_at?: number | null;
  };

  const status = payload.status ?? row.status;
  const totalRequests = payload.request_counts?.total ?? row.totalRequests;
  const completedRequests = payload.request_counts?.completed ?? row.completedRequests;
  const errorCount = payload.request_counts?.failed ?? row.errorCount;
  const isTerminal =
    status === 'completed' ||
    status === 'failed' ||
    status === 'expired' ||
    status === 'cancelled';

  const update: Record<string, unknown> = {
    status,
    totalRequests,
    completedRequests,
    errorCount,
  };
  if (isTerminal) {
    update.completedAt = payload.completed_at
      ? new Date(payload.completed_at * 1000)
      : new Date();
  }
  // Snapshot the output/error file ids onto metadata so fetchBatchResults
  // can pull them without re-polling.
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  if (payload.output_file_id) metadata.outputFileId = payload.output_file_id;
  if (payload.error_file_id) metadata.errorFileId = payload.error_file_id;
  update.metadata = metadata;

  await db.update(llmBatchJobs).set(update).where(eq(llmBatchJobs.id, batchId));

  return {
    id: row.id,
    externalBatchId: row.externalBatchId,
    status,
    totalRequests,
    completedRequests,
    errorCount,
    workload: row.workload,
    resultsStoragePath: row.resultsStoragePath,
    completedAt: isTerminal ? (update.completedAt as Date | null) ?? null : null,
  };
}

/**
 * One parsed result line from a completed batch.
 */
export interface BatchResultLine {
  customId: string;
  response: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
}

/**
 * Download the output JSONL of a completed batch and parse each line.
 * Caller is responsible for persisting/processing the results downstream
 * (e.g. writing embeddings to the semantic-search table).
 */
export async function fetchBatchResults(
  batchId: string,
  apiKeyOverride?: string
): Promise<BatchResultLine[]> {
  const apiKey = getApiKey(apiKeyOverride);
  const row = await loadBatchRow(batchId);
  if (row.status !== 'completed') {
    throw new BatchError(
      'not_ready',
      `Batch ${batchId} is in status ${row.status}; results are not available yet.`,
      409
    );
  }

  const meta = (row.metadata ?? {}) as { outputFileId?: string };
  if (!meta.outputFileId) {
    throw new BatchError(
      'no_output_file',
      `Batch ${batchId} has no output_file_id recorded.`,
      502
    );
  }

  const res = await fetch(`${OPENAI_BASE_URL}/files/${meta.outputFileId}/content`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new BatchError(
      'fetch_results_failed',
      `OpenAI file fetch failed (${res.status}): ${detail.slice(0, 300)}`,
      502
    );
  }
  const text = await res.text();
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const parsed: BatchResultLine[] = lines.map((line) => {
    try {
      const obj = JSON.parse(line) as {
        custom_id?: string;
        response?: Record<string, unknown> | null;
        error?: Record<string, unknown> | null;
      };
      return {
        customId: obj.custom_id ?? '',
        response: obj.response ?? null,
        error: obj.error ?? null,
      };
    } catch {
      return { customId: '', response: null, error: { message: 'unparseable line' } };
    }
  });

  // Persist storage pointer so we can re-load later without re-downloading.
  const storagePath = `openai://files/${meta.outputFileId}`;
  await db
    .update(llmBatchJobs)
    .set({ resultsStoragePath: storagePath })
    .where(eq(llmBatchJobs.id, batchId));

  return parsed;
}

/**
 * Convenience: list of workloads that should be routed to the Batch API
 * rather than the sync endpoint. Used by callers to assert routing intent.
 */
export const BATCH_ROUTED_WORKLOADS: ReadonlySet<BatchWorkload> = new Set([
  'embedding_backfill',
  'weekly_summary',
  'stale_janitor',
  'release_notes',
  'triage_backfill',
]);

export function shouldRouteToBatch(workload: BatchWorkload): boolean {
  return BATCH_ROUTED_WORKLOADS.has(workload);
}

export { BatchError };
