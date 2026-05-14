/**
 * Anthropic prompt-caching helper.
 *
 * Claude's "ephemeral" prompt caching lets us mark stable blocks (system
 * prompt, tool schemas, few-shot examples) with `cache_control: { type:
 * "ephemeral" }`. On subsequent requests within the cache TTL (~5 min) the
 * server reuses the cached prefix at ~10% of the input-token cost and
 * reports the reused size on `usage.cache_read_input_tokens`.
 *
 * The rule we enforce here:
 *   1. Cache breakpoints are placed AT or BEFORE dynamic user content.
 *   2. Only the last block in the stable prefix needs the marker — Claude
 *      caches everything before the marker too.
 *   3. Dynamic content (the user's actual question, fresh project context)
 *      must stay AFTER the last marker so cache misses don't propagate.
 *   4. Up to 4 markers are allowed by the API; we cap defensively.
 *
 * Feature flag: AI_PROMPT_CACHE_ENABLED (default true). Setting it to
 * "false" or "0" disables caching cluster-wide for emergency rollback.
 */

export type CacheControl = { type: 'ephemeral' };

export interface TextBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
}

export interface ToolDefinition {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
  cache_control?: CacheControl;
}

const MAX_BREAKPOINTS = 4;

/**
 * Read the AI_PROMPT_CACHE_ENABLED flag. Defaults to true so we get the
 * cost reduction in production without a config push. Set to "false" / "0"
 * to disable.
 */
export function isPromptCacheEnabled(): boolean {
  const raw = process.env.AI_PROMPT_CACHE_ENABLED;
  if (raw === undefined || raw === null || raw === '') {
    return true;
  }
  const normalized = String(raw).trim().toLowerCase();
  return !(normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off');
}

/**
 * Add ephemeral cache breakpoints to the stable parts of a content array.
 *
 * Strategy:
 *   - Mark the LAST block as ephemeral (Claude caches the full prefix
 *     up to that breakpoint).
 *   - If there are well-defined section boundaries (each item is a
 *     separate logical block such as "tools" vs "examples"), mark up
 *     to MAX_BREAKPOINTS so partial reuse still works when only a tail
 *     section changes.
 *
 * `blocks` must contain ONLY the stable prefix. Dynamic content (the user
 * message, project state that changes per call) should be appended AFTER
 * by the caller.
 */
export function withCacheBreakpoints<T extends TextBlock>(blocks: T[]): T[] {
  if (!isPromptCacheEnabled()) {
    // Strip any cache_control markers so caching is fully bypassed.
    return blocks.map((block) => {
      const { cache_control: _unused, ...rest } = block;
      return { ...rest } as T;
    });
  }

  if (blocks.length === 0) {
    return blocks;
  }

  const stamped: T[] = blocks.map((block) => ({ ...block }));

  // Always mark the final stable block.
  stamped[stamped.length - 1] = {
    ...stamped[stamped.length - 1],
    cache_control: { type: 'ephemeral' },
  } as T;

  // If we have multiple distinct stable sections, mark up to MAX_BREAKPOINTS-1
  // additional internal section boundaries so partial-tail invalidation
  // still benefits from earlier-prefix reuse. For 2-3 blocks we leave a
  // single tail marker (most efficient when the whole prefix is stable).
  if (stamped.length >= 4) {
    // Place markers evenly through the prefix (excluding the already-marked tail).
    const stride = Math.max(1, Math.floor(stamped.length / MAX_BREAKPOINTS));
    let placed = 1; // tail counts as 1
    for (let i = stride; i < stamped.length - 1 && placed < MAX_BREAKPOINTS; i += stride) {
      stamped[i] = { ...stamped[i], cache_control: { type: 'ephemeral' } } as T;
      placed += 1;
    }
  }

  return stamped;
}

/**
 * Mark a single tool definition for caching. The Anthropic API treats tool
 * schemas as part of the cacheable prefix when the last tool carries the
 * `cache_control` marker.
 */
export function withCachedTools(tools: ToolDefinition[]): ToolDefinition[] {
  if (!isPromptCacheEnabled() || tools.length === 0) {
    return tools.map((tool) => {
      const { cache_control: _unused, ...rest } = tool;
      return { ...rest };
    });
  }
  const stamped: ToolDefinition[] = tools.map((tool) => ({ ...tool }));
  const last = stamped[stamped.length - 1];
  if (last) {
    stamped[stamped.length - 1] = {
      name: last.name,
      description: last.description,
      input_schema: last.input_schema,
      cache_control: { type: 'ephemeral' },
    };
  }
  return stamped;
}

/**
 * Wrap a single string into a TextBlock. Useful when the existing call site
 * has a single concatenated system prompt — we convert it into the structured
 * array form Claude expects for cache_control.
 */
export function asTextBlock(text: string, cache = false): TextBlock {
  return cache && isPromptCacheEnabled()
    ? { type: 'text', text, cache_control: { type: 'ephemeral' } }
    : { type: 'text', text };
}

/**
 * Convenience helper: build a system-prompt array from
 *   - a fixed instructions block (always cached)
 *   - optional tool/few-shot blocks (cached)
 *   - dynamic context (NOT cached, appended last)
 *
 * Only the prefix array returned here is intended to go into the `system`
 * field of the Anthropic request. Dynamic per-call data should be passed
 * via `messages[].content` instead.
 */
export function buildCachedSystemPrompt(parts: {
  instructions: string;
  toolSchemaBlock?: string;
  fewShotBlock?: string;
}): TextBlock[] {
  const blocks: TextBlock[] = [{ type: 'text', text: parts.instructions }];
  if (parts.toolSchemaBlock) {
    blocks.push({ type: 'text', text: parts.toolSchemaBlock });
  }
  if (parts.fewShotBlock) {
    blocks.push({ type: 'text', text: parts.fewShotBlock });
  }
  return withCacheBreakpoints(blocks);
}

/**
 * Extract token-usage metrics including cache stats from an Anthropic
 * response payload. Returns zeros when the fields are missing so callers
 * can safely write to an audit log without conditional checks.
 */
export function extractAnthropicCacheUsage(payload: unknown): {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
} {
  const usage =
    (payload as { usage?: Record<string, unknown> } | null | undefined)?.usage ?? {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    inputTokens: num((usage as Record<string, unknown>).input_tokens),
    outputTokens: num((usage as Record<string, unknown>).output_tokens),
    cacheReadTokens: num((usage as Record<string, unknown>).cache_read_input_tokens),
    cacheCreationTokens: num((usage as Record<string, unknown>).cache_creation_input_tokens),
  };
}
