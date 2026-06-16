import { describe, expect, it, vi } from 'vitest'

// Mock all the AI SDK providers
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({
    chat: vi.fn(() => ({ modelId: 'openai-gpt' })),
  })),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn(() => ({ modelId: 'anthropic-claude' }))),
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() =>
    vi.fn(() => ({ modelId: 'google-gemini' })),
  ),
}))

vi.mock('@ai-sdk/deepseek', () => ({
  createDeepSeek: vi.fn(() => vi.fn(() => ({ modelId: 'deepseek-model' }))),
}))

vi.mock('ai-sdk-ollama', () => ({
  createOllama: vi.fn(() => vi.fn(() => ({ modelId: 'ollama-model' }))),
}))

import { getAIModel } from '../../../src/main/ai/factory'

describe('getAIModel', () => {
  it('creates OpenAI model', () => {
    const model = getAIModel({
      id: 'test',
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o',
    } as any)

    expect(model).toBeDefined()
    expect(model.modelId).toBe('openai-gpt')
  })

  it('creates Anthropic model', () => {
    const model = getAIModel({
      id: 'test',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-3-5-sonnet',
    } as any)

    expect(model).toBeDefined()
  })

  it('creates Google/Gemini model', () => {
    const model = getAIModel({
      id: 'test',
      provider: 'gemini',
      apiKey: 'gsk-test',
      model: 'gemini-2.0-flash',
    } as any)

    expect(model).toBeDefined()
  })

  it('creates DeepSeek model', () => {
    const model = getAIModel({
      id: 'test',
      provider: 'deepseek',
      apiKey: 'ds-test',
      model: 'deepseek-v3',
    } as any)

    expect(model).toBeDefined()
  })

  it('creates Ollama model with default URL', () => {
    const model = getAIModel({
      id: 'test',
      provider: 'ollama',
      model: 'llama3',
    } as any)

    expect(model).toBeDefined()
  })

  it('creates Ollama model with custom URL', () => {
    const model = getAIModel({
      id: 'test',
      provider: 'ollama',
      baseUrl: 'http://192.168.1.100:11434',
      model: 'mistral',
    } as any)

    expect(model).toBeDefined()
  })

  it('creates openai-compatible model', () => {
    const model = getAIModel({
      id: 'test',
      provider: 'openai-compatible',
      apiKey: 'sk-test',
      baseUrl: 'https://custom-api.com/v1',
      model: 'custom-model',
    } as any)

    expect(model).toBeDefined()
  })

  it('creates others model with anthropic compatibility', () => {
    const model = getAIModel({
      id: 'test',
      provider: 'others',
      apiKey: 'sk-test',
      baseUrl: 'https://custom-anthropic.com',
      model: 'custom-claude',
      compatibility: 'anthropic',
    } as any)

    expect(model).toBeDefined()
  })

  it('creates others model with google compatibility', () => {
    const model = getAIModel({
      id: 'test',
      provider: 'others',
      apiKey: 'sk-test',
      baseUrl: 'https://custom-google.com',
      model: 'custom-gemini',
      compatibility: 'google',
    } as any)

    expect(model).toBeDefined()
  })

  it('throws for unsupported provider', () => {
    expect(() =>
      getAIModel({
        id: 'test',
        provider: 'unsupported-provider',
        model: 'test',
      } as any),
    ).toThrow('Unsupported AI provider')
  })
})
