/**
 * Embedding worker — converts a queued (content_type, content_id) job into
 * an OpenAI text-embedding-3-small (1536-dim) vector, then UPSERTs into
 * content_embeddings keyed by (content_type, content_id).
 *
 * The Postgres trigger installed in migration 0028_hybrid_search.sql writes
 * a row into content_embeddings_queue and PERFORM pg_notify on every
 * relevant change. The worker is invoked either:
 *
 *   - from a long-lived process (LISTEN content_embeddings_jobs), or
 *   - synchronously after-commit in API routes (small queue, low latency).
 *
 * We hash the embeddable text (MD5) and skip work if the row's existing
 * content_hash matches — handy when triggers fire on noise updates.
 *
 * The OpenAI key resolution mirrors apps/web/src/lib/ai/draft-issue.ts so
 * we share the same secret plumbing across features.
 */

import crypto from 'crypto';
import {
  db,
  issues,
  issueComments,
  contentEmbeddings,
  contentEmbeddingsQueue,
  eq,
  and,
  sql,
} from '@tasknebula/db';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

export type EmbedContentType = 'issue' | 'comment';

export interface EmbeddingProvider {
  embed(text: string): Promise<{ vector: number[]; tokens: number }>;
}

/**
 * Default provider: OpenAI text-embedding-3-small. Lives behind the same
 * OPENAI_API_KEY env var the existing draft-issue feature uses.
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  constructor(private apiKey: string, private model: string = EMBEDDING_MODEL) {}

  async embed(text: string): Promise<{ vector: number[]; tokens: number }> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `OpenAI embeddings returned ${response.status}: ${detail.slice(0, 200)}`
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding: number[] }>;
      usage?: { total_tokens?: number };
    };

    const vector = payload.data?.[0]?.embedding;
    if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `OpenAI embeddings returned ${vector?.length ?? 0}-dim vector; expected ${EMBEDDING_DIMENSIONS}`
      );
    }

    return { vector, tokens: payload.usage?.total_tokens ?? 0 };
  }
}

export function getDefaultEmbeddingProvider(): EmbeddingProvider | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAIEmbeddingProvider(key);
}

/**
 * Build the text we feed into the embedder. We intentionally include the
 * issue key (e.g. "ACME-123") so vector retrieval can hit cross-references.
 */
export function buildIssueEmbedText(input: {
  key: string;
  title: string;
  description: string | null;
}): string {
  const parts = [input.key, input.title];
  if (input.description) parts.push(input.description);
  return parts.join('\n\n');
}

export function buildCommentEmbedText(input: { content: string }): string {
  return input.content;
}

export function hashText(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * Format a vector for pgvector's text-input form: '[v1,v2,...]'.
 */
export function vectorToPg(vector: number[]): string {
  return '[' + vector.join(',') + ']';
}

export interface ProcessJobInput {
  contentType: EmbedContentType;
  contentId: string;
  provider?: EmbeddingProvider | null;
}

export interface ProcessJobResult {
  status: 'embedded' | 'skipped_unchanged' | 'skipped_missing' | 'skipped_no_provider';
  tokens?: number;
}

/**
 * Process one embedding job. Idempotent and safe to retry.
 *
 *  1. Loads the source row (issue or comment).
 *  2. Builds the embed text + MD5 hash.
 *  3. Compares hash to existing content_embeddings row; if equal, skip.
 *  4. Otherwise call the embedding provider and UPSERT.
 */
export async function processEmbeddingJob(
  input: ProcessJobInput
): Promise<ProcessJobResult> {
  const provider = input.provider ?? getDefaultEmbeddingProvider();

  let text: string;
  let snippet: string;
  let issueId: string | null = null;
  let commentId: string | null = null;
  let projectId: string | null = null;

  if (input.contentType === 'issue') {
    const [row] = await db
      .select({
        id: issues.id,
        key: issues.key,
        title: issues.title,
        description: issues.description,
        projectId: issues.projectId,
      })
      .from(issues)
      .where(eq(issues.id, input.contentId))
      .limit(1);
    if (!row) return { status: 'skipped_missing' };
    text = buildIssueEmbedText({ key: row.key, title: row.title, description: row.description });
    snippet = text.slice(0, 500);
    issueId = row.id;
    projectId = row.projectId;
  } else if (input.contentType === 'comment') {
    const [row] = await db
      .select({ id: issueComments.id, content: issueComments.content, issueId: issueComments.issueId })
      .from(issueComments)
      .where(eq(issueComments.id, input.contentId))
      .limit(1);
    if (!row) return { status: 'skipped_missing' };
    text = buildCommentEmbedText({ content: row.content });
    snippet = text.slice(0, 500);
    commentId = row.id;
    issueId = row.issueId;
  } else {
    return { status: 'skipped_missing' };
  }

  const hash = hashText(text);

  const existing = await db
    .select({ id: contentEmbeddings.id, hash: contentEmbeddings.contentHash, version: contentEmbeddings.version })
    .from(contentEmbeddings)
    .where(
      and(
        eq(contentEmbeddings.contentType, input.contentType),
        eq(contentEmbeddings.contentId, input.contentId)
      )
    )
    .limit(1);

  if (existing[0]?.hash === hash) {
    return { status: 'skipped_unchanged' };
  }

  if (!provider) {
    return { status: 'skipped_no_provider' };
  }

  const { vector, tokens } = await provider.embed(text);
  const vecLiteral = vectorToPg(vector);

  // Upsert via ON CONFLICT (content_type, content_id).
  await db.execute(sql`
    INSERT INTO content_embeddings (
      id, content_type, content_id, issue_id, comment_id, project_id,
      content_snippet, embedding, embedding_model, embedding_provider,
      tokens_used, content_hash, version, created_at, updated_at
    )
    VALUES (
      ${crypto.randomUUID()}, ${input.contentType}, ${input.contentId},
      ${issueId}, ${commentId}, ${projectId},
      ${snippet}, ${vecLiteral}::vector(${sql.raw(String(EMBEDDING_DIMENSIONS))}),
      ${EMBEDDING_MODEL}, 'openai',
      ${tokens}, ${hash}, 1, now(), now()
    )
    ON CONFLICT (content_type, content_id) DO UPDATE SET
      embedding = EXCLUDED.embedding,
      content_snippet = EXCLUDED.content_snippet,
      embedding_model = EXCLUDED.embedding_model,
      embedding_provider = EXCLUDED.embedding_provider,
      tokens_used = EXCLUDED.tokens_used,
      content_hash = EXCLUDED.content_hash,
      version = content_embeddings.version + 1,
      issue_id = EXCLUDED.issue_id,
      comment_id = EXCLUDED.comment_id,
      project_id = EXCLUDED.project_id,
      updated_at = now();
  `);

  return { status: 'embedded', tokens };
}

/**
 * Drain pending jobs from content_embeddings_queue. Safe to call from a
 * cron, a LISTEN/NOTIFY handler, or after-commit in an API route.
 *
 * We use SKIP LOCKED so multiple workers can drain concurrently without
 * stepping on each other.
 */
export async function drainEmbeddingQueue(options: {
  batchSize?: number;
  provider?: EmbeddingProvider | null;
} = {}): Promise<{ processed: number; failed: number }> {
  const batchSize = options.batchSize ?? 16;
  const provider = options.provider ?? getDefaultEmbeddingProvider();

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < batchSize; i++) {
    const claimed = await db.execute<{ id: number; content_type: string; content_id: string }>(sql`
      WITH job AS (
        SELECT id, content_type, content_id
        FROM content_embeddings_queue
        WHERE status = 'pending'
        ORDER BY enqueued_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE content_embeddings_queue q
      SET status = 'running', started_at = now(), attempts = q.attempts + 1
      FROM job
      WHERE q.id = job.id
      RETURNING q.id, q.content_type, q.content_id;
    `);

    // postgres-js returns an array-like with `count`; normalize.
    const rows = Array.isArray(claimed) ? claimed : (claimed as any).rows ?? [];
    if (rows.length === 0) break;

    const row = rows[0];
    try {
      await processEmbeddingJob({
        contentType: row.content_type as EmbedContentType,
        contentId: row.content_id,
        provider,
      });
      await db.execute(sql`
        UPDATE content_embeddings_queue
        SET status = 'done', completed_at = now()
        WHERE id = ${row.id};
      `);
      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(sql`
        UPDATE content_embeddings_queue
        SET status = 'failed', last_error = ${message}, completed_at = now()
        WHERE id = ${row.id};
      `);
      failed += 1;
    }
  }

  return { processed, failed };
}

/**
 * Enqueue a job directly (used by API routes that have just written an
 * issue/comment and want to avoid a roundtrip through the trigger).
 */
export async function enqueueEmbeddingJob(input: {
  contentType: EmbedContentType;
  contentId: string;
  organizationId?: string | null;
  projectId?: string | null;
}): Promise<void> {
  await db.insert(contentEmbeddingsQueue).values({
    contentType: input.contentType,
    contentId: input.contentId,
    organizationId: input.organizationId ?? null,
    projectId: input.projectId ?? null,
  });
  // Best-effort notify; ignored when listener is absent.
  await db.execute(sql`SELECT pg_notify('content_embeddings_jobs', ${input.contentType + ':' + input.contentId});`).catch(() => undefined);
}
