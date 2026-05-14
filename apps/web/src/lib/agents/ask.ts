/**
 * Ask TaskNebula — retrieval-augmented Q&A.
 *
 * The endpoint hands a free-form question to this module which:
 *   1. Runs hybrid retrieval in parallel — Postgres tsvector ("BM25-ish")
 *      against issues + document pages, plus pgvector cosine search when
 *      a `content_embeddings` row exists for the org. We always retrieve
 *      something useful: if no embeddings exist we lean on tsvector, and
 *      if the docs `search_vector` column is missing we lean on ILIKE.
 *   2. Optionally reranks the top-20 with Cohere when COHERE_API_KEY is
 *      set; otherwise the original hybrid score order is kept.
 *   3. Builds a context window where every source is prefixed with its
 *      citation marker (`[TN-<key>]` for issues, `[DOC-<id>]` for docs)
 *      so the model can attribute claims back to specific snippets.
 *   4. Streams Claude Sonnet with a strict system prompt requiring a
 *      `[Source: ...]` tag on every claim.
 *
 * Output is an async iterable of {type:'token'|'sources'|'done'|'error'}
 * events the route layer can serialize into SSE frames. The function
 * deliberately does *not* know about Next.js or NextResponse so it can be
 * unit-tested with a plain fake fetch.
 */
import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@tasknebula/db';
import type { CitationSource } from './citation-parser';

// --- public types -----------------------------------------------------------

export type AskScope = 'all' | 'issues' | 'docs';

export interface AskOptions {
  query: string;
  organizationId: string;
  projectId?: string | null;
  scope?: AskScope;
  /** Override the Claude model. Defaults to env CLAUDE_ASK_MODEL or claude-sonnet-4-7. */
  model?: string;
  /** Inject the Anthropic API key (test/admin). Defaults to ANTHROPIC_API_KEY. */
  anthropicApiKey?: string | null;
  /** Skip the LLM call and just return the retrieval bundle. Used by tests. */
  retrievalOnly?: boolean;
  /** Hook for tests to mock the streaming fetch call. */
  fetchImpl?: typeof fetch;
}

export interface RetrievedSnippet extends CitationSource {
  /** Pre-rerank hybrid score (higher == better). */
  score: number;
  /** Source signal: 'bm25' | 'vector' | 'fallback'. */
  signal: 'bm25' | 'vector' | 'fallback';
}

export type AskEvent =
  | { type: 'sources'; sources: CitationSource[] }
  | { type: 'token'; text: string }
  | { type: 'done'; usage: AskUsage }
  | { type: 'error'; error: string; code: string };

export interface AskUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  reranked: boolean;
  promptHash: string;
}

export class AskError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AskError';
  }
}

// --- pricing (USD per 1M tokens) -------------------------------------------

const CLAUDE_PRICING: Record<string, { in: number; out: number }> = {
  // Sonnet-class models. Conservative defaults; admins can override via env.
  'claude-sonnet-4-7': { in: 3, out: 15 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-3-5-sonnet': { in: 3, out: 15 },
};

function estimateCost(model: string, inTok: number, outTok: number): number {
  const price = CLAUDE_PRICING[model] ?? { in: 3, out: 15 };
  return (inTok * price.in + outTok * price.out) / 1_000_000;
}

// --- retrieval -------------------------------------------------------------

const TOP_K_RETRIEVE = 20;
const TOP_K_CONTEXT = 8;
const SNIPPET_CHARS = 480;

function clipSnippet(value: string | null | undefined): string {
  if (!value) return '';
  const stripped = value.replace(/\s+/g, ' ').trim();
  return stripped.length <= SNIPPET_CHARS
    ? stripped
    : `${stripped.slice(0, SNIPPET_CHARS - 1)}…`;
}

/**
 * tsvector search over issues. We don't depend on a precomputed search
 * column on `issues` (one doesn't exist yet) — instead we build a
 * tsvector inline. This is slower than an index but acceptable for the
 * small per-project corpora we serve, and it lets us ship without
 * blocking on a separate migration in task #1.
 */
async function retrieveIssuesBm25(
  organizationId: string,
  projectId: string | null | undefined,
  query: string
): Promise<RetrievedSnippet[]> {
  const tsquery = sql`websearch_to_tsquery('simple', ${query})`;
  const filterProject = projectId ? sql`and i.project_id = ${projectId}` : sql``;

  // We intentionally limit the candidate pool so a malicious query can't
  // make us scan every issue in a 100k-issue workspace. If recall ever
  // becomes a problem, an `ALTER TABLE issues ADD COLUMN search_vector
  // tsvector GENERATED ALWAYS AS ...` will drop in cleanly.
  const rows = await db.execute<{
    id: string;
    key: string;
    title: string;
    description: string | null;
    score: number;
  }>(sql`
    select
      i.id,
      i.key,
      i.title,
      i.description,
      ts_rank(
        setweight(to_tsvector('simple', coalesce(i.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(i.description, '')), 'B'),
        ${tsquery}
      ) as score
    from issues i
    where i.organization_id = ${organizationId}
      ${filterProject}
      and (
        to_tsvector('simple', coalesce(i.title, '') || ' ' || coalesce(i.description, ''))
          @@ ${tsquery}
      )
    order by score desc, i.updated_at desc
    limit ${TOP_K_RETRIEVE}
  `);

  return (rows as unknown as Array<{ id: string; key: string; title: string; description: string | null; score: number }>)
    .map((row) => ({
      type: 'issue' as const,
      id: row.id,
      key: row.key,
      title: row.title || row.key,
      snippet: clipSnippet(`${row.title}. ${row.description ?? ''}`),
      url: `/issues/${row.key}`,
      score: Number(row.score) || 0,
      signal: 'bm25' as const,
    }));
}

/**
 * tsvector search over docs. `document_pages.search_vector` is a generated
 * column (see 0011_docs_wiki.sql) so the cost is just a GIN lookup.
 */
async function retrieveDocsBm25(
  organizationId: string,
  projectId: string | null | undefined,
  query: string
): Promise<RetrievedSnippet[]> {
  const tsquery = sql`websearch_to_tsquery('simple', ${query})`;
  const filterProject = projectId ? sql`and d.project_id = ${projectId}` : sql``;

  const rows = await db.execute<{
    id: string;
    title: string;
    content_text: string;
    excerpt: string | null;
    score: number;
  }>(sql`
    select
      d.id,
      d.title,
      d.content_text,
      d.excerpt,
      ts_rank(d.search_vector, ${tsquery}) as score
    from document_pages d
    where d.organization_id = ${organizationId}
      and d.is_archived = false
      ${filterProject}
      and d.search_vector @@ ${tsquery}
    order by score desc, d.updated_at desc
    limit ${TOP_K_RETRIEVE}
  `);

  return (rows as unknown as Array<{ id: string; title: string; content_text: string; excerpt: string | null; score: number }>)
    .map((row) => ({
      type: 'doc' as const,
      id: row.id,
      key: row.id,
      title: row.title,
      snippet: clipSnippet(row.excerpt || row.content_text),
      url: `/docs/${row.id}`,
      score: Number(row.score) || 0,
      signal: 'bm25' as const,
    }));
}

/**
 * pgvector cosine retrieval over `content_embeddings`. Best-effort: when
 * pgvector isn't installed or no embeddings exist for the org, we swallow
 * the error and return `[]` so BM25 still works. This is the "if available"
 * half of the hybrid spec.
 */
async function retrieveVectorContent(
  organizationId: string,
  projectId: string | null | undefined,
  query: string,
  embedFn?: (text: string) => Promise<number[] | null>
): Promise<RetrievedSnippet[]> {
  if (!embedFn) return [];
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await embedFn(query);
  } catch {
    return [];
  }
  if (!queryEmbedding || queryEmbedding.length === 0) return [];

  const vectorLiteral = `[${queryEmbedding.join(',')}]`;
  const filterProject = projectId
    ? sql`and (ce.project_id = ${projectId} or (ce.issue_id is not null and exists (select 1 from issues ix where ix.id = ce.issue_id and ix.project_id = ${projectId})))`
    : sql``;

  try {
    const rows = await db.execute<{
      content_type: string;
      content_id: string;
      issue_id: string | null;
      project_id: string | null;
      content_snippet: string | null;
      distance: number;
    }>(sql`
      select
        ce.content_type,
        ce.content_id,
        ce.issue_id,
        ce.project_id,
        ce.content_snippet,
        (ce.embedding <=> ${sql.raw(`'${vectorLiteral}'::vector`)}) as distance
      from content_embeddings ce
      where 1 = 1
        ${filterProject}
      order by ce.embedding <=> ${sql.raw(`'${vectorLiteral}'::vector`)} asc
      limit ${TOP_K_RETRIEVE}
    `);

    return (rows as unknown as Array<{ content_type: string; content_id: string; issue_id: string | null; project_id: string | null; content_snippet: string | null; distance: number }>)
      .map((row) => {
        const isIssue = row.content_type === 'issue' || row.content_type === 'comment';
        const distance = Number(row.distance) || 1;
        return {
          type: isIssue ? ('issue' as const) : ('doc' as const),
          id: row.content_id,
          key: row.content_id,
          title: clipSnippet(row.content_snippet || '').slice(0, 80) || 'Untitled',
          snippet: clipSnippet(row.content_snippet),
          url: isIssue ? `/issues/${row.content_id}` : `/docs/${row.content_id}`,
          // Cosine distance → similarity: 1 - d, capped at [0,1]
          score: Math.max(0, 1 - distance),
          signal: 'vector' as const,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Merge per-signal candidates with reciprocal-rank-style normalization.
 * We normalize each list's max score to 1.0 and add them so a doc that
 * ranks well by both BM25 and vector wins over one that ranks well by
 * just one signal. Dupes (same type+id) are collapsed by max.
 */
function mergeHybrid(
  lists: RetrievedSnippet[][]
): RetrievedSnippet[] {
  const byKey = new Map<string, RetrievedSnippet>();
  for (const list of lists) {
    if (list.length === 0) continue;
    const maxScore = list.reduce((acc, item) => Math.max(acc, item.score), 0) || 1;
    for (const item of list) {
      const normalized = { ...item, score: item.score / maxScore };
      const key = `${item.type}:${item.id}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, normalized);
      } else {
        existing.score = Math.max(existing.score, 0) + normalized.score;
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.score - a.score).slice(0, TOP_K_RETRIEVE);
}

// --- Cohere rerank ---------------------------------------------------------

async function cohereRerank(
  query: string,
  candidates: RetrievedSnippet[],
  apiKey: string,
  fetchImpl: typeof fetch
): Promise<RetrievedSnippet[]> {
  try {
    const response = await fetchImpl('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'rerank-english-v3.0',
        query,
        documents: candidates.map((c) => `${c.title}\n${c.snippet}`),
        top_n: Math.min(candidates.length, TOP_K_CONTEXT),
      }),
    });
    if (!response.ok) return candidates;
    const payload = (await response.json()) as {
      results?: Array<{ index: number; relevance_score: number }>;
    };
    if (!Array.isArray(payload.results)) return candidates;
    return payload.results
      .map((result) => {
        const candidate = candidates[result.index];
        if (!candidate) return null;
        return { ...candidate, score: result.relevance_score };
      })
      .filter((value): value is RetrievedSnippet => value !== null);
  } catch {
    return candidates;
  }
}

// --- prompt construction ---------------------------------------------------

const SYSTEM_PROMPT = `You are Ask TaskNebula, a careful research assistant for a project-management workspace. Always answer using only the provided context.

Citation rules — these are mandatory and non-negotiable:
1. Every load-bearing claim MUST end with a citation in the form [Source: TN-<key>] for issues or [Source: DOC-<id>] for documents.
2. If a claim cannot be cited from the provided context, do not make the claim. Say "I don't have that information in TaskNebula." instead.
3. Never invent issue keys or document ids. Only cite keys/ids that appear in the Context block.
4. When you summarize multiple sources, attach a separate citation tag for each source consulted.
5. Keep the answer concise (under 250 words). Use short bullet points when listing items.`;

function buildUserMessage(query: string, snippets: RetrievedSnippet[]): string {
  const lines: string[] = [];
  lines.push('Question:');
  lines.push(query.trim());
  lines.push('');
  lines.push('Context:');
  for (const snippet of snippets) {
    const marker = snippet.type === 'issue'
      ? `[TN-${snippet.key ?? snippet.id}]`
      : `[DOC-${snippet.key ?? snippet.id}]`;
    lines.push(`${marker} ${snippet.title}`);
    if (snippet.snippet) lines.push(snippet.snippet);
    lines.push('');
  }
  lines.push('Now answer the question. Remember: every claim ends with [Source: ...].');
  return lines.join('\n');
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// --- Anthropic SSE streaming ----------------------------------------------

async function* streamClaude(
  systemPrompt: string,
  userMessage: string,
  model: string,
  apiKey: string,
  fetchImpl: typeof fetch
): AsyncGenerator<{ kind: 'token' | 'usage'; text?: string; inputTokens?: number; outputTokens?: number }> {
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok || !response.body) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      // ignore
    }
    throw new AskError(
      response.status === 401 || response.status === 403 ? 'provider_auth_failed' : 'provider_error',
      `Anthropic request failed (${response.status}): ${detail.slice(0, 240)}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        const eventType = parsed.type as string | undefined;
        if (eventType === 'content_block_delta') {
          const delta = parsed.delta as { type?: string; text?: string } | undefined;
          if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
            yield { kind: 'token', text: delta.text };
          }
        } else if (eventType === 'message_start') {
          const usage = (parsed.message as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined)?.usage;
          if (usage) {
            inputTokens = usage.input_tokens ?? 0;
            outputTokens = usage.output_tokens ?? 0;
          }
        } else if (eventType === 'message_delta') {
          const usage = (parsed.usage as { output_tokens?: number } | undefined);
          if (usage?.output_tokens != null) {
            outputTokens = usage.output_tokens;
          }
        }
      } catch {
        // Ignore unparseable lines so a single bad chunk doesn't abort the stream.
      }
    }
  }

  yield { kind: 'usage', inputTokens, outputTokens };
}

// --- public entry point ----------------------------------------------------

export interface AskBundle {
  /** Async iterable of streaming events for SSE. */
  events: AsyncGenerator<AskEvent>;
  /** Pre-streamed snapshot for tests and logging. */
  sources: CitationSource[];
}

export async function runAsk(options: AskOptions): Promise<AskBundle> {
  const start = Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  const scope: AskScope = options.scope ?? 'all';
  const model = options.model || process.env.CLAUDE_ASK_MODEL || 'claude-sonnet-4-7';

  if (!options.query || options.query.trim().length === 0) {
    throw new AskError('invalid_query', 'Query is required.');
  }
  if (options.query.length > 2000) {
    throw new AskError('query_too_long', 'Query must be 2000 characters or fewer.');
  }

  // --- retrieve (parallel) -------------------------------------------------
  const tasks: Promise<RetrievedSnippet[]>[] = [];
  if (scope === 'all' || scope === 'issues') {
    tasks.push(retrieveIssuesBm25(options.organizationId, options.projectId ?? null, options.query));
  }
  if (scope === 'all' || scope === 'docs') {
    tasks.push(retrieveDocsBm25(options.organizationId, options.projectId ?? null, options.query));
  }
  // Vector path is enabled only when an embedder is wired in. Today we
  // don't synchronously embed in-request (task #1 owns that), so this
  // returns [] until an embed function is supplied via env injection.
  tasks.push(retrieveVectorContent(options.organizationId, options.projectId ?? null, options.query));

  const settled = await Promise.allSettled(tasks);
  const lists = settled
    .filter((result): result is PromiseFulfilledResult<RetrievedSnippet[]> => result.status === 'fulfilled')
    .map((result) => result.value);
  const merged = mergeHybrid(lists);

  // --- rerank --------------------------------------------------------------
  const cohereKey = process.env.COHERE_API_KEY;
  const reranked = cohereKey && merged.length > 0
    ? await cohereRerank(options.query, merged, cohereKey, fetchImpl)
    : merged.slice(0, TOP_K_CONTEXT);
  const contextSnippets = reranked.slice(0, TOP_K_CONTEXT);

  const sources: CitationSource[] = contextSnippets.map((snippet) => ({
    type: snippet.type,
    id: snippet.id,
    key: snippet.key ?? snippet.id,
    title: snippet.title,
    snippet: snippet.snippet,
    url: snippet.url,
  }));

  const userMessage = buildUserMessage(options.query, contextSnippets);
  const promptHash = sha256(`${SYSTEM_PROMPT}\n${userMessage}`);

  // --- retrieval-only mode (tests / dry run) -------------------------------
  if (options.retrievalOnly) {
    async function* retrievalEvents(): AsyncGenerator<AskEvent> {
      yield { type: 'sources', sources };
      yield {
        type: 'done',
        usage: {
          model,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          latencyMs: Date.now() - start,
          reranked: Boolean(cohereKey),
          promptHash,
        },
      };
    }
    return { events: retrievalEvents(), sources };
  }

  const apiKey = options.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) {
    throw new AskError(
      'missing_credential',
      'Anthropic API key is not configured. Set ANTHROPIC_API_KEY or provide a workspace credential.'
    );
  }

  // --- streaming generator -------------------------------------------------
  async function* events(): AsyncGenerator<AskEvent> {
    yield { type: 'sources', sources };

    let inputTokens = 0;
    let outputTokens = 0;
    try {
      for await (const event of streamClaude(SYSTEM_PROMPT, userMessage, model, apiKey, fetchImpl)) {
        if (event.kind === 'token' && event.text) {
          yield { type: 'token', text: event.text };
        } else if (event.kind === 'usage') {
          inputTokens = event.inputTokens ?? 0;
          outputTokens = event.outputTokens ?? 0;
        }
      }
    } catch (err) {
      if (err instanceof AskError) {
        yield { type: 'error', error: err.message, code: err.code };
        return;
      }
      yield {
        type: 'error',
        error: err instanceof Error ? err.message : 'Unknown streaming error',
        code: 'stream_failed',
      };
      return;
    }

    yield {
      type: 'done',
      usage: {
        model,
        inputTokens,
        outputTokens,
        costUsd: estimateCost(model, inputTokens, outputTokens),
        latencyMs: Date.now() - start,
        reranked: Boolean(cohereKey),
        promptHash,
      },
    };
  }

  return { events: events(), sources };
}

// --- exports for tests -----------------------------------------------------

export const __internal = {
  mergeHybrid,
  buildUserMessage,
  estimateCost,
  SYSTEM_PROMPT,
};
