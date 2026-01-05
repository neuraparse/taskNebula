// LLM Provider types

export type LLMProvider = 'openai' | 'anthropic' | 'azure-openai' | 'mistral' | 'local';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse>;
  complete(prompt: string, options?: Partial<LLMConfig>): Promise<LLMResponse>;
}

