import { ChatApi } from '../../shared/context/ChatMockContext';
import { SettingsMock } from '../../shared/context/MockViewContext';

export const AIChatMockData: ChatApi = {
  getSettings: async () => {
    const ai = await SettingsMock.getAI();
    const agents = await SettingsMock.getAgents();
    const prompts = await SettingsMock.getPrompts();
    const keybindings = await SettingsMock.getKeybindings();
    const tools = await SettingsMock.getTools();
    
    return {
      ai: { activeId: ai.activeId, providers: ai.list },
      agents: { activeId: agents.activeId, list: agents.list },
      prompts: { files: prompts.list },
      keybindings: keybindings.list,
      aiTools: tools.active,
      appearance: { theme: 'nord', fontScale: 1, customFonts: {} }
    } as any;
  },
  updateSettings: async (settings) => { console.log('Mock: updateSettings', settings); },
  listSessions: async () => [
    { id: '1', date: '2024-05-01', preview: 'How do I center a div?', lastModified: Date.now() - 3600000 },
    { id: '2', date: '2024-05-02', preview: 'Explain quantum computing.', lastModified: Date.now() - 86400000 }
  ],
  loadSession: async (id, date) => [
    { id: 'm1', role: 'user', content: 'Hello!' },
    { id: 'm2', role: 'assistant', content: 'Hello! How can I help you today?' }
  ],
  saveSession: async (id, messages) => { console.log('Mock: saveSession', id, messages.length); },
  readFile: async (path) => `Content of ${path}`,
  getAvailableSkills: async () => [
    { name: 'Web Search', path: '/skills/web-search' },
    { name: 'Calculator', path: '/skills/calc' }
  ],
  getAvailableCommands: async () => [
    { name: 'List Files', path: '/cmds/ls' },
    { name: 'System Info', path: '/cmds/sysinfo' }
  ],
  getFiles: async (dirPath) => [
    { path: `${dirPath}/file1.txt`, name: 'file1.txt', isDirectory: false },
    { path: `${dirPath}/subdir`, name: 'subdir', isDirectory: true }
  ],
  runDirectCommand: async (payload) => ({ stdout: `Executed ${payload.commandPath}`, stderr: '' }),
  requestApproval: async (command, cwd) => {
    console.log('Mock: requestApproval', command, cwd);
    return true;
  }
};
