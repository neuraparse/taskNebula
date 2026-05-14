/**
 * @jest-environment node
 */

import {
  asTextBlock,
  buildCachedSystemPrompt,
  extractAnthropicCacheUsage,
  isPromptCacheEnabled,
  withCacheBreakpoints,
  withCachedTools,
} from '../cache-blocks';

describe('isPromptCacheEnabled', () => {
  const original = process.env.AI_PROMPT_CACHE_ENABLED;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.AI_PROMPT_CACHE_ENABLED;
    } else {
      process.env.AI_PROMPT_CACHE_ENABLED = original;
    }
  });

  it('defaults to true when unset', () => {
    delete process.env.AI_PROMPT_CACHE_ENABLED;
    expect(isPromptCacheEnabled()).toBe(true);
  });

  it('is true for empty string', () => {
    process.env.AI_PROMPT_CACHE_ENABLED = '';
    expect(isPromptCacheEnabled()).toBe(true);
  });

  it('is false for "false" / "0" / "off"', () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'false';
    expect(isPromptCacheEnabled()).toBe(false);
    process.env.AI_PROMPT_CACHE_ENABLED = '0';
    expect(isPromptCacheEnabled()).toBe(false);
    process.env.AI_PROMPT_CACHE_ENABLED = 'OFF';
    expect(isPromptCacheEnabled()).toBe(false);
  });

  it('is true for "true"', () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'true';
    expect(isPromptCacheEnabled()).toBe(true);
  });
});

describe('withCacheBreakpoints', () => {
  const original = process.env.AI_PROMPT_CACHE_ENABLED;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.AI_PROMPT_CACHE_ENABLED;
    } else {
      process.env.AI_PROMPT_CACHE_ENABLED = original;
    }
  });

  it('returns empty array unchanged', () => {
    expect(withCacheBreakpoints([])).toEqual([]);
  });

  it('marks only the last block when given a small prefix', () => {
    const blocks = [
      { type: 'text' as const, text: 'system' },
      { type: 'text' as const, text: 'tools' },
    ];
    const out = withCacheBreakpoints(blocks);
    expect(out[0].cache_control).toBeUndefined();
    expect(out[1].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('places at most 4 breakpoints for long prefixes', () => {
    const blocks = Array.from({ length: 10 }, (_, i) => ({
      type: 'text' as const,
      text: `block-${i}`,
    }));
    const out = withCacheBreakpoints(blocks);
    const markers = out.filter((b) => b.cache_control?.type === 'ephemeral');
    expect(markers.length).toBeGreaterThanOrEqual(2);
    expect(markers.length).toBeLessThanOrEqual(4);
    // Tail must always be marked.
    expect(out[out.length - 1].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('strips cache_control when the flag is disabled', () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'false';
    const blocks = [
      { type: 'text' as const, text: 'a', cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: 'b' },
    ];
    const out = withCacheBreakpoints(blocks);
    expect(out.every((b) => b.cache_control === undefined)).toBe(true);
  });
});

describe('withCachedTools', () => {
  it('marks the last tool only', () => {
    const tools = [
      { name: 'a', input_schema: {} },
      { name: 'b', input_schema: {} },
      { name: 'c', input_schema: {} },
    ];
    const out = withCachedTools(tools);
    expect(out[0].cache_control).toBeUndefined();
    expect(out[1].cache_control).toBeUndefined();
    expect(out[2].cache_control).toEqual({ type: 'ephemeral' });
  });
});

describe('asTextBlock', () => {
  it('returns a plain block by default', () => {
    expect(asTextBlock('hello')).toEqual({ type: 'text', text: 'hello' });
  });
  it('returns a cached block when requested', () => {
    expect(asTextBlock('hello', true)).toEqual({
      type: 'text',
      text: 'hello',
      cache_control: { type: 'ephemeral' },
    });
  });
});

describe('buildCachedSystemPrompt', () => {
  it('puts instructions first and marks the tail for caching', () => {
    const out = buildCachedSystemPrompt({
      instructions: 'You are TaskNebula.',
      toolSchemaBlock: '{"schema":1}',
    });
    expect(out).toHaveLength(2);
    expect(out[0].text).toContain('TaskNebula');
    expect(out[0].cache_control).toBeUndefined();
    expect(out[1].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('only emits instructions when no extras provided', () => {
    const out = buildCachedSystemPrompt({ instructions: 'Just rules.' });
    expect(out).toHaveLength(1);
    expect(out[0].cache_control).toEqual({ type: 'ephemeral' });
  });
});

describe('extractAnthropicCacheUsage', () => {
  it('returns zeros for missing payloads', () => {
    expect(extractAnthropicCacheUsage(null)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
  });

  it('reads usage fields when present', () => {
    expect(
      extractAnthropicCacheUsage({
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 90,
          cache_creation_input_tokens: 10,
        },
      })
    ).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 90,
      cacheCreationTokens: 10,
    });
  });
});
