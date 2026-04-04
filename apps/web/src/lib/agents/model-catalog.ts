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

export function getModelCatalogForProvider(provider: AgentProvider) {
  if (provider === 'openai') {
    return OPENAI_MODEL_CATALOG;
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

export function getModelCatalogEntry(provider: AgentProvider, model: string) {
  if (provider === 'openai') {
    return inferOpenAiModelCapabilities(model);
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
