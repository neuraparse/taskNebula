import OpenAI from 'openai';
import type { LLMClient, LLMConfig, LLMMessage, LLMResponse } from './types';

/**
 * OpenAI Client Implementation
 */
export class OpenAIClient implements LLMClient {
  private client: OpenAI;

  constructor(private config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: options?.model || this.config.model || 'gpt-4o-mini',
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: options?.temperature || this.config.temperature || 0.7,
        max_tokens: options?.maxTokens || this.config.maxTokens || 2000,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response from OpenAI');
      }

      return {
        content: choice.message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw error;
    }
  }

  async complete(prompt: string, options?: Partial<LLMConfig>): Promise<LLMResponse> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }
}

/**
 * Base LLM Client (Fallback/Mock)
 */
export class BaseLLMClient implements LLMClient {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
    console.log('LLM Chat Request (Mock):', { messages, options });

    return {
      content: 'This is a mock LLM response. Set OPENAI_API_KEY to use real AI.',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      model: this.config.model,
    };
  }

  async complete(prompt: string, options?: Partial<LLMConfig>): Promise<LLMResponse> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }
}

/**
 * Factory function to create LLM client based on provider
 */
export function createLLMClient(config: LLMConfig): LLMClient {
  const provider = config.provider || 'openai';

  switch (provider) {
    case 'openai':
      return new OpenAIClient(config);
    // case 'anthropic':
    //   return new AnthropicClient(config);
    default:
      return new BaseLLMClient(config);
  }
}

