import { DEFAULT_AI_CONFIG, DEFAULT_AI_TOOLS } from '../../../lib/constants/ai';
import { DEFAULT_KEYBINDINGS } from './keybindings';

export const DEFAULT_SETTINGS = {
  activeTheme: 'nord',
  ai: DEFAULT_AI_CONFIG,
  keybindings: DEFAULT_KEYBINDINGS,
  prompts: {
    files: []
  },
  aiTools: DEFAULT_AI_TOOLS,
  agents: {
    list: [],
    activeId: ''
  }
};
