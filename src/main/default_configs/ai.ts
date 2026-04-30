export const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  ollama: 'gemma4:e4b',
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-latest',
  gemini: 'gemini-1.5-pro-latest',
  deepseek: 'deepseek-v4-flash',
  others: 'gpt-4o'
};

export const DEFAULT_PROVIDER_URLS: Record<string, string> = {
  ollama: 'http://localhost:11434',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
  deepseek: 'https://api.deepseek.com',
  others: ''
};

export const DEFAULT_AI_CONFIG = {
  activeId: 'default-ollama',
  providers: [
    {
      id: 'default-ollama',
      name: `Ollama - ${DEFAULT_PROVIDER_MODELS.ollama}`,
      provider: 'ollama',
      url: DEFAULT_PROVIDER_URLS.ollama,
      model: DEFAULT_PROVIDER_MODELS.ollama,
      contextWindow: 8192
    }
  ]
};
