import { app } from 'electron';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

export function getConfigDir() {
  if (process.platform === 'win32') {
    return path.join(app.getPath('appData'), 'citron');
  } else {
    return path.join(os.homedir(), '.citron');
  }
}

export async function initAppFolders() {
  const baseDir = getConfigDir();
  
  const folders = ['config', 'skills', 'commands', 'workspace'];
  for (const folder of folders) {
    const dir = path.join(baseDir, folder);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  const configDir = path.join(baseDir, 'config');

  // Default configs
  const defaults: Record<string, any> = {
    'appearance.json': { theme: 'dark' },
    'keybindings.json': { commandTab: 'META+X', chatTab: 'META+Y' },
    'ai.json': { 
      provider: 'gemini', 
      configs: { 
        gemini: { apiKey: '', url: '' },
        deepseek: { apiKey: '', url: '' },
        ollama: { apiKey: '', url: 'http://localhost:11434' }
      } 
    }
  };

  for (const [file, content] of Object.entries(defaults)) {
    const filePath = path.join(configDir, file);
    if (!existsSync(filePath)) {
      await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');
    }
  }
}

export async function loadConfig() {
  const configDir = path.join(getConfigDir(), 'config');
  
  const readJson = async (file: string, fallback: any) => {
    try {
      const data = await fs.readFile(path.join(configDir, file), 'utf-8');
      return JSON.parse(data);
    } catch {
      return fallback;
    }
  };

  const appearance = await readJson('appearance.json', { theme: 'dark' });
  const keybindings = await readJson('keybindings.json', { commandTab: 'META+X', chatTab: 'META+Y' });
  const ai = await readJson('ai.json', { provider: 'gemini', configs: {} });

  return {
    theme: appearance.theme || 'dark',
    keybindings: {
      commandTab: keybindings.commandTab || 'META+X',
      chatTab: keybindings.chatTab || 'META+Y'
    },
    aiProvider: ai.provider || 'gemini',
    aiConfigs: ai.configs || {}
  };
}

export async function saveConfig(settings: any) {
  const configDir = path.join(getConfigDir(), 'config');

  const appearance = { theme: settings.theme };
  const keybindings = { commandTab: settings.keybindings?.commandTab, chatTab: settings.keybindings?.chatTab };
  const ai = { provider: settings.aiProvider, configs: settings.aiConfigs };

  await fs.writeFile(path.join(configDir, 'appearance.json'), JSON.stringify(appearance, null, 2), 'utf-8');
  await fs.writeFile(path.join(configDir, 'keybindings.json'), JSON.stringify(keybindings, null, 2), 'utf-8');
  await fs.writeFile(path.join(configDir, 'ai.json'), JSON.stringify(ai, null, 2), 'utf-8');
  
  return true;
}
