import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { createOllama } from 'ai-sdk-ollama'

import type { AIProvider } from '../../lib/types/ai'

export type { AIProvider }

/**
 * Provider options that disable reasoning/thinking for all supported providers.
 * Use this for simple tasks (summarization, commit messages, etc.) where
 * reasoning is unnecessary and only adds latency + cost.
 */
export const DISABLED_REASONING_OPTIONS: Record<string, any> = {
  anthropic: { thinking: { type: 'disabled' } },
  deepseek: { thinking: { type: 'disabled' } },
  google: { thinkingConfig: { thinkingLevel: 'minimal' } },
  openai: { reasoning_effort: null },
}

export function getAIModel(config: AIProvider): LanguageModel {
  const { provider, apiKey, baseUrl, model, compatibility } = config

  switch (provider.toLowerCase()) {
    case 'openai':
      return createOpenAI({
        apiKey,
        baseURL: baseUrl,
      }).chat(model) // Force Chat completions API

    case 'anthropic':
      return createAnthropic({
        apiKey,
      })(model)

    case 'google':
    case 'gemini':
      return createGoogleGenerativeAI({
        apiKey,
        baseURL: baseUrl,
      })(model)

    case 'deepseek':
      return createDeepSeek({
        apiKey,
        baseURL: baseUrl,
      })(model)

    case 'ollama': {
      return createOllama({
        baseURL: baseUrl || 'http://localhost:11434/api',
      })(model)
    }

    case 'openai-compatible':
      return createOpenAI({
        apiKey,
        baseURL: baseUrl,
        compatibility: 'compatible',
      } as any).chat(model)

    case 'others': {
      if (compatibility === 'anthropic') {
        return createAnthropic({ apiKey, baseURL: baseUrl })(model)
      }
      if (compatibility === 'google') {
        return createGoogleGenerativeAI({ apiKey, baseURL: baseUrl })(model)
      }
      // Default others to OpenAI-compatible
      return createOpenAI({
        apiKey,
        baseURL: baseUrl,
        compatibility: 'compatible',
      } as any).chat(model)
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}
