export interface AIProviderInstance {
  id: string;
  name: string;
  provider: 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'others';
  apiKey?: string;
  url?: string;
  model: string;
  compatibility?: 'openai' | 'anthropic' | 'google';
  contextWindow?: number;
}

export interface SettingsState {
  activeTheme: string;
  ai: {
    activeId: string;
    providers: AIProviderInstance[];
  };
  skills?: {
    folders: string[];
  };
  commands?: {
    folders: string[];
  };
  keybindings: {
    global: { [key: string]: string };
    explorer: { [key: string]: string };
    agent: { [key: string]: string };
    content: {
      navigation: { [key: string]: string };
      viewer: { [key: string]: string };
      generic: { [key: string]: string };
    };
  };
  prompts: {
    files: string[];
  };
  aiTools: { [key: string]: boolean };
}
