import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModel } from 'ai';

export interface ProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  compatibility?: 'openai' | 'anthropic' | 'google';
}

export function getProviderModel(config: ProviderConfig): LanguageModel {
  const { provider, apiKey, baseUrl, model, compatibility } = config;

  switch (provider.toLowerCase()) {
    case 'openai':
      return createOpenAI({
        apiKey,
        baseURL: baseUrl,
      }).chat(model); // Force Chat completions API

    case 'anthropic':
      return createAnthropic({
        apiKey,
      })(model);

    case 'google':
    case 'gemini':
      return createGoogleGenerativeAI({
        apiKey,
      })(model);

    case 'ollama':
    case 'deepseek':
    case 'others':
    case 'openai-compatible':
      // If it's "others", we check the compatibility field
      const actualCompatibility = provider === 'others' ? compatibility : (provider === 'ollama' || provider === 'deepseek' ? 'openai' : 'openai');

      if (actualCompatibility === 'anthropic') {
        return createAnthropic({
          apiKey,
          baseURL: baseUrl,
        })(model);
      }
      
      if (actualCompatibility === 'google') {
        return createGoogleGenerativeAI({
          apiKey,
          baseURL: baseUrl,
        })(model);
      }

      // Default to OpenAI-compatible
      let finalBaseUrl = baseUrl;
      if (provider === 'ollama' && finalBaseUrl && !finalBaseUrl.endsWith('/v1') && !finalBaseUrl.endsWith('/v1/')) {
        finalBaseUrl = finalBaseUrl.replace(/\/$/, '') + '/v1';
      }
      
      const customOpenAI = createOpenAI({
        apiKey: apiKey || 'no-key',
        baseURL: finalBaseUrl,
      });
      
      // We must use .chat() here too for standard OpenAI-compatible proxies (Ollama, DeepSeek, etc)
      return customOpenAI.chat(model);

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
