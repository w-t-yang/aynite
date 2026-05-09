import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

import type { AIProvider } from '../../lib/types/ai'

export type { AIProvider }

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
      let finalBaseUrl = baseUrl
      if (finalBaseUrl && !finalBaseUrl.endsWith('/v1') && !finalBaseUrl.endsWith('/v1/')) {
        finalBaseUrl = `${finalBaseUrl.replace(/\/$/, '')}/v1`
      }
      return createOpenAI({
        apiKey: apiKey || 'no-key',
        baseURL: finalBaseUrl,
        compatibility: 'compatible',
      }).chat(model)
    }

    case 'openai-compatible':
      return createOpenAI({
        apiKey,
        baseURL: baseUrl,
        compatibility: 'compatible',
      }).chat(model)

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
      }).chat(model)
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}
