import {
  getModelCatalogEntry,
  getModelMaxOutputTokensLimit,
  getSupportedReasoningOptions,
  modelSupportsReasoning,
} from '@/lib/agents/model-catalog';

describe('agent model catalog', () => {
  it('returns the current GPT-5.4 preset with extended reasoning options', () => {
    const entry = getModelCatalogEntry('openai', 'gpt-5.4');

    expect(entry?.id).toBe('gpt-5.4');
    expect(entry?.reasoningOptions).toContain('xhigh');
    expect(entry?.maxOutputTokensLimit).toBe(128000);
  });

  it('treats gpt-5-chat-latest as a non-reasoning chat preset', () => {
    expect(getSupportedReasoningOptions('openai', 'gpt-5-chat-latest')).toEqual(['none']);
    expect(modelSupportsReasoning('openai', 'gpt-5-chat-latest')).toBe(false);
    expect(getModelMaxOutputTokensLimit('openai', 'gpt-5-chat-latest')).toBe(16384);
  });

  it('infers larger output limits for pro-family GPT-5 models', () => {
    expect(getModelMaxOutputTokensLimit('openai', 'gpt-5.4-pro')).toBe(128000);
    expect(getModelMaxOutputTokensLimit('openai', 'gpt-5-pro')).toBe(272000);
    expect(getSupportedReasoningOptions('openai', 'gpt-5.4-pro')).toContain('xhigh');
  });
});
