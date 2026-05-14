/**
 * Optional audit hook for AI provider calls.
 *
 * Task #7 was scoped to add a `cached_tokens` column to an LLM audit table.
 * If/when that lands, the implementation of `recordPromptCacheUsage` can
 * insert into the table directly. Until then, this hook only emits a
 * structured console log so a metrics scraper (Datadog/Loki) can
 * tally cache hit rates without a DB migration.
 *
 * Callers MUST treat this hook as optional and never throw out of it.
 */

export interface PromptCacheUsageRecord {
  provider: 'anthropic' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
  /**
   * Number of input tokens served from cache. Maps to
   * Anthropic's `cache_read_input_tokens` and OpenAI's
   * `usage.prompt_tokens_details.cached_tokens`.
   */
  cachedTokens: number;
  /**
   * Anthropic-only — tokens consumed when populating the cache for the
   * first time (charged at 1.25x the standard input rate).
   */
  cacheCreationTokens?: number;
}

export function recordPromptCacheUsage(record: PromptCacheUsageRecord): void {
  // Defensive: never let logging break a request.
  try {
    const safe = {
      provider: record.provider,
      model: record.model,
      inputTokens: Number.isFinite(record.inputTokens) ? record.inputTokens : 0,
      outputTokens: Number.isFinite(record.outputTokens) ? record.outputTokens : 0,
      cachedTokens: Number.isFinite(record.cachedTokens) ? record.cachedTokens : 0,
      cacheCreationTokens: Number.isFinite(record.cacheCreationTokens ?? 0)
        ? record.cacheCreationTokens ?? 0
        : 0,
    };
    // Structured log line — pickable by a Loki/Datadog parser. When task #7
    // ships the audit table, replace with an INSERT.
    // eslint-disable-next-line no-console
    console.info('[ai.cache.usage]', JSON.stringify(safe));
  } catch {
    // ignore
  }
}
