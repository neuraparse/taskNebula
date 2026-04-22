import type { AgentProvider } from './config';

export const AGENT_REASONING_EFFORT_OPTIONS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const;

export type AgentReasoningEffort = (typeof AGENT_REASONING_EFFORT_OPTIONS)[number];
export type AgentReasoningEffortOption = AgentReasoningEffort | 'none';

export type AgentModelCatalogEntry = {
  id: string;
  provider: AgentProvider;
  label: string;
  summary: string;
  group: 'latest' | 'high-throughput' | 'chat' | 'legacy';
  reasoningOptions: AgentReasoningEffortOption[];
  maxOutputTokensLimit: number;
  supportsTemperature: boolean;
};

export const OPENAI_MODEL_CATALOG: AgentModelCatalogEntry[] = [
  {
    id: 'gpt-5.4-pro',
    provider: 'openai',
    label: 'GPT-5.4 pro',
    summary: 'Highest-precision GPT-5.4 variant for very hard reasoning.',
    group: 'latest',
    reasoningOptions: ['medium', 'high', 'xhigh'],
    maxOutputTokensLimit: 128000,
    supportsTemperature: true,
  },
  {
    id: 'gpt-5.4',
    provider: 'openai',
    label: 'GPT-5.4',
    summary: 'Latest frontier reasoning model for high-accuracy work.',
    group: 'latest',
    reasoningOptions: ['none', 'low', 'medium', 'high', 'xhigh'],
    maxOutputTokensLimit: 128000,
    supportsTemperature: true,
  },
  {
    id: 'gpt-5.4-mini',
    provider: 'openai',
    label: 'GPT-5.4 mini',
    summary: 'Cheaper GPT-5.4-class model for frequent agent runs.',
    group: 'high-throughput',
    reasoningOptions: ['none', 'low', 'medium', 'high', 'xhigh'],
    maxOutputTokensLimit: 128000,
    supportsTemperature: true,
  },
  {
    id: 'gpt-5.4-nano',
    provider: 'openai',
    label: 'GPT-5.4 nano',
    summary: 'Lowest-cost GPT-5.4-class model for lightweight automation.',
    group: 'high-throughput',
    reasoningOptions: ['none', 'low', 'medium', 'high', 'xhigh'],
    maxOutputTokensLimit: 128000,
    supportsTemperature: true,
  },
  {
    id: 'gpt-5.2',
    provider: 'openai',
    label: 'GPT-5.2',
    summary: 'Previous frontier model, still useful when matching older behavior.',
    group: 'legacy',
    reasoningOptions: ['none', 'low', 'medium', 'high', 'xhigh'],
    maxOutputTokensLimit: 128000,
    supportsTemperature: true,
  },
  {
    id: 'gpt-5-pro',
    provider: 'openai',
    label: 'GPT-5 pro',
    summary: 'GPT-5 pro-family model for slower, deeper reasoning.',
    group: 'legacy',
    reasoningOptions: ['high'],
    maxOutputTokensLimit: 272000,
    supportsTemperature: true,
  },
  {
    id: 'gpt-5',
    provider: 'openai',
    label: 'GPT-5',
    summary: 'Previous intelligent reasoning model with configurable effort.',
    group: 'legacy',
    reasoningOptions: ['none', 'minimal', 'low', 'medium', 'high'],
    maxOutputTokensLimit: 128000,
    supportsTemperature: true,
  },
  {
    id: 'gpt-5-mini',
    provider: 'openai',
    label: 'GPT-5 mini',
    summary: 'Balanced lower-cost GPT-5 model.',
    group: 'legacy',
    reasoningOptions: ['none', 'minimal', 'low', 'medium', 'high'],
    maxOutputTokensLimit: 128000,
    supportsTemperature: true,
  },
  {
    id: 'gpt-5-nano',
    provider: 'openai',
    label: 'GPT-5 nano',
    summary: 'Small GPT-5 model for lightweight tasks.',
    group: 'legacy',
    reasoningOptions: ['none', 'minimal', 'low', 'medium', 'high'],
    maxOutputTokensLimit: 128000,
    supportsTemperature: true,
  },
  // Real, currently-shipped OpenAI models — safe defaults users can rely on.
  {
    id: 'gpt-4o',
    provider: 'openai',
    label: 'GPT-4o',
    summary: 'OpenAI flagship multimodal model. Strong default for production drafting.',
    group: 'latest',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 16384,
    supportsTemperature: true,
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o mini',
    summary: 'Fast + cheap OpenAI model. Best price/perf for issue drafting and triage.',
    group: 'high-throughput',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 16384,
    supportsTemperature: true,
  },
  {
    id: 'gpt-4-turbo',
    provider: 'openai',
    label: 'GPT-4 Turbo',
    summary: 'GPT-4 128K context. Older but still reliable for structured output.',
    group: 'legacy',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 4096,
    supportsTemperature: true,
  },
  {
    id: 'gpt-4',
    provider: 'openai',
    label: 'GPT-4',
    summary: 'Original GPT-4. Use only for compatibility; prefer 4o or newer.',
    group: 'legacy',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 8192,
    supportsTemperature: true,
  },
  {
    id: 'gpt-3.5-turbo',
    provider: 'openai',
    label: 'GPT-3.5 Turbo',
    summary: 'Cheapest OpenAI option; may miss nuances in complex prompts.',
    group: 'legacy',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 4096,
    supportsTemperature: true,
  },
  {
    id: 'o1',
    provider: 'openai',
    label: 'o1',
    summary: 'Reasoning-focused model for hard analytical tasks.',
    group: 'latest',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 32768,
    supportsTemperature: false,
  },
  {
    id: 'o1-mini',
    provider: 'openai',
    label: 'o1-mini',
    summary: 'Smaller reasoning model, faster + cheaper than o1.',
    group: 'high-throughput',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 16384,
    supportsTemperature: false,
  },
  {
    id: 'gpt-5-chat-latest',
    provider: 'openai',
    label: 'GPT-5 chat latest',
    summary: 'General-purpose chat-optimized GPT-5 variant.',
    group: 'chat',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 16384,
    supportsTemperature: true,
  },
];

export const ANTHROPIC_MODEL_CATALOG: AgentModelCatalogEntry[] = [
  // Latest (Claude 4.x)
  {
    id: 'claude-opus-4-7',
    provider: 'anthropic',
    label: 'Claude Opus 4.7',
    summary: 'Frontier Claude model — highest reasoning quality, supports 1M context.',
    group: 'latest',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 8192,
    supportsTemperature: true,
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    label: 'Claude Sonnet 4.6',
    summary: 'Balanced Claude Sonnet — strong reasoning at lower cost than Opus.',
    group: 'latest',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 8192,
    supportsTemperature: true,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    label: 'Claude Haiku 4.5',
    summary: 'Fast, cheap Claude Haiku for high-volume automation.',
    group: 'high-throughput',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 8192,
    supportsTemperature: true,
  },
  // Older Claude 3.x variants (kept for teams on older Anthropic SDK / policy)
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    label: 'Claude 3.5 Sonnet (2024-10)',
    summary: 'Widely-deployed Sonnet 3.5. Use only if your org policy mandates the 3.x line.',
    group: 'legacy',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 8192,
    supportsTemperature: true,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    label: 'Claude 3.5 Haiku',
    summary: 'Cheap 3.5 Haiku — fastest/cheapest on the 3.x line.',
    group: 'legacy',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 8192,
    supportsTemperature: true,
  },
  {
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    label: 'Claude 3 Opus',
    summary: 'Previous-generation top-tier Claude. Prefer 4.x unless pinned by policy.',
    group: 'legacy',
    reasoningOptions: ['none'],
    maxOutputTokensLimit: 4096,
    supportsTemperature: true,
  },
];

export function getModelCatalogForProvider(provider: AgentProvider) {
  if (provider === 'openai') {
    return OPENAI_MODEL_CATALOG;
  }
  if (provider === 'anthropic') {
    return ANTHROPIC_MODEL_CATALOG;
  }

  return [] as AgentModelCatalogEntry[];
}

function inferOpenAiModelCapabilities(model: string): AgentModelCatalogEntry | null {
  const normalized = model.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const exact = OPENAI_MODEL_CATALOG.find((entry) => entry.id === normalized);
  if (exact) {
    return exact;
  }

  if (normalized.startsWith('gpt-5.4')) {
    return {
      id: normalized,
      provider: 'openai',
      label: normalized,
      summary: 'GPT-5.4-family model.',
      group: 'latest',
      reasoningOptions: ['none', 'low', 'medium', 'high', 'xhigh'],
      maxOutputTokensLimit: 128000,
      supportsTemperature: true,
    };
  }

  if (normalized === 'gpt-5-chat-latest') {
    return {
      id: normalized,
      provider: 'openai',
      label: normalized,
      summary: 'Chat-optimized GPT-5 model.',
      group: 'chat',
      reasoningOptions: ['none'],
      maxOutputTokensLimit: 16384,
      supportsTemperature: true,
    };
  }

  if (normalized.includes('gpt-5') && normalized.includes('pro')) {
    return {
      id: normalized,
      provider: 'openai',
      label: normalized,
      summary: 'High-intelligence GPT-5 pro-family model.',
      group: 'latest',
      reasoningOptions: ['high', 'xhigh'],
      maxOutputTokensLimit: 272000,
      supportsTemperature: true,
    };
  }

  if (normalized.startsWith('gpt-5')) {
    return {
      id: normalized,
      provider: 'openai',
      label: normalized,
      summary: 'GPT-5-family reasoning model.',
      group: 'legacy',
      reasoningOptions: ['none', 'minimal', 'low', 'medium', 'high'],
      maxOutputTokensLimit: 128000,
      supportsTemperature: true,
    };
  }

  if (normalized.startsWith('gpt-4')) {
    return {
      id: normalized,
      provider: 'openai',
      label: normalized,
      summary: 'GPT-4-family model.',
      group: 'legacy',
      reasoningOptions: ['none'],
      maxOutputTokensLimit: 16384,
      supportsTemperature: true,
    };
  }

  return null;
}

function inferAnthropicModelCapabilities(model: string): AgentModelCatalogEntry | null {
  const normalized = model.trim().toLowerCase();
  if (!normalized) return null;
  const exact = ANTHROPIC_MODEL_CATALOG.find((entry) => entry.id === normalized);
  if (exact) return exact;
  if (normalized.startsWith('claude-')) {
    return {
      id: normalized,
      provider: 'anthropic',
      label: normalized,
      summary: 'Claude-family model.',
      group: normalized.includes('haiku') ? 'high-throughput' : 'latest',
      reasoningOptions: ['none'],
      maxOutputTokensLimit: 8192,
      supportsTemperature: true,
    };
  }
  return null;
}

export function getModelCatalogEntry(provider: AgentProvider, model: string) {
  if (provider === 'openai') {
    return inferOpenAiModelCapabilities(model);
  }
  if (provider === 'anthropic') {
    return inferAnthropicModelCapabilities(model);
  }

  return null;
}

export function getSupportedReasoningOptions(
  provider: AgentProvider,
  model: string
): AgentReasoningEffortOption[] {
  return getModelCatalogEntry(provider, model)?.reasoningOptions || ['none', 'low', 'medium', 'high'];
}

export function getModelMaxOutputTokensLimit(provider: AgentProvider, model: string) {
  return getModelCatalogEntry(provider, model)?.maxOutputTokensLimit || 8192;
}

export function modelSupportsReasoning(provider: AgentProvider, model: string) {
  return getSupportedReasoningOptions(provider, model).some((option) => option !== 'none');
}

export function modelSupportsTemperature(provider: AgentProvider, model: string) {
  const entry = getModelCatalogEntry(provider, model);
  return entry ? entry.supportsTemperature : true;
}
