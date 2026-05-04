/**
 * Config Router
 *
 * Maps ConfigKey-based getConfig/setConfig calls from the renderer
 * to the correct backend logic across modules.
 */
import { app } from 'electron';
import { ConfigKey } from '../../lib/constants/config';
import { WorkspaceConfig, LayoutConfig } from '../../lib/constants/types';
import { loadConfig, saveConfig } from './logic';
import {
  getWorkspacesList,
  switchWorkspace,
  createWorkspace,
  getWorkspaceFolders,
  getWorkspaceState,
} from '../workspace';

import {
  getThemesList,
  getTheme,
  saveTheme,
} from '../theme';
import {
  listSessions,
  saveSession,
  loadSession,
} from '../ai/chat';
import { getMergedSystemPrompt } from '../ai/prompts';
import { getToolsMetadata } from '../ai/tools';
import {
  readJson,
  writeJson,
  getWorkspaceDataPath,
  getMainConfigPath,
  getKeybindingsConfigPath,
  getAIConfigPath,
} from '../../lib/path';

import { DEFAULT_WORKSPACE_CONFIG } from '../../lib/constants/workspace';



/**
 * getConfig — route a ConfigKey to the appropriate data source.
 */
export async function routeGetConfig(key: string, payload?: any): Promise<any> {
  switch (key) {
    case ConfigKey.WORKSPACES: {
      const wsConfig = await getWorkspacesList();
      const configs: WorkspaceConfig[] = [];
      for (const wsName of wsConfig.list) {
        const state = await getWorkspaceState(wsName);
        configs.push(state);
      }
      return configs;
    }


    case ConfigKey.ACTIVE_WORKSPACE: {
      const wsConfig = await getWorkspacesList();
      return wsConfig.active;
    }

    case ConfigKey.KEYBINDINGS: {
      const config = await loadConfig();
      return config.keybindings;
    }

    case ConfigKey.VIEWS: {
      const config = await loadConfig();
      return (config as any).views || [];
    }

    case ConfigKey.THEMES: {
      return await getThemesList();
    }

    case ConfigKey.THEME: {
      const themeId = payload as string;
      return await getTheme(themeId || 'light');
    }

    case ConfigKey.ACTIVE_THEME: {
      const mainConfig = await readJson<any>(getMainConfigPath(), {});
      return mainConfig.activeTheme || 'light';
    }

    case ConfigKey.CHAT_LOGS: {
      return await listSessions();
    }

    case ConfigKey.LOAD_CHAT_LOG: {
      if (payload && payload.id && payload.date) {
        return await loadSession(payload.id, payload.date);
      }
      return null;
    }

    case ConfigKey.MERGED_SYSTEM_PROMPT: {
      return await getMergedSystemPrompt(payload?.globalFiles, payload?.agentFiles);
    }

    case ConfigKey.AI: {
      const config = await loadConfig();
      return config.ai;
    }

    case ConfigKey.AGENTS: {
      const config = await loadConfig();
      return (config as any).agents || { activeId: 'aynite', list: [] };
    }

    case ConfigKey.PROMPTS: {
      const config = await loadConfig();
      return (config as any).prompts || { files: [] };
    }

    case ConfigKey.SKILLS: {
      const config = await loadConfig();
      return (config as any).skills || { folders: [] };
    }

    case ConfigKey.COMMANDS: {
      const config = await loadConfig();
      return (config as any).commands || { folders: [] };
    }

    case ConfigKey.TOOLS: {
      return await getToolsMetadata();
    }

    case ConfigKey.VERSION: {
      return app.getVersion();
    }

    default:
      console.warn(`[ConfigRouter] Unknown getConfig key: ${key}`);
      return null;
  }
}

/**
 * setConfig — route a ConfigKey to the appropriate data sink.
 */
export async function routeSetConfig(key: string, payload: any): Promise<boolean> {
  switch (key) {
    case ConfigKey.ACTIVE_WORKSPACE: {
      const id = payload as string;
      await switchWorkspace(id);
      return true;
    }

    case ConfigKey.WORKSPACE: {
      const { id, config } = payload as { id: string; config: WorkspaceConfig };
      const dataPath = getWorkspaceDataPath(id);
      await writeJson(dataPath, { ...config, id });

      return true;
    }

    case ConfigKey.KEYBINDINGS: {
      await writeJson(getKeybindingsConfigPath(), payload);
      return true;
    }

    case ConfigKey.ACTIVE_THEME: {
      const mainConfig = await readJson<any>(getMainConfigPath(), {});
      mainConfig.activeTheme = payload;
      await writeJson(getMainConfigPath(), mainConfig);
      return true;
    }

    case ConfigKey.THEME: {
      const { id, theme } = payload as { id: string; theme: any };
      await saveTheme(id, theme);
      return true;
    }

    case ConfigKey.SAVE_CHAT_LOG: {
      if (payload && payload.id && payload.messages) {
        await saveSession(payload.id, payload.messages);
      }
      return true;
    }

    case ConfigKey.AI: {
      await writeJson(getAIConfigPath(), payload);
      return true;
    }

    case ConfigKey.AGENTS:
    case ConfigKey.PROMPTS:
    case ConfigKey.SKILLS:
    case ConfigKey.COMMANDS: {
      // These are sub-keys of the main config
      const mainConfig = await readJson<any>(getMainConfigPath(), {});
      mainConfig[key] = payload;
      await writeJson(getMainConfigPath(), mainConfig);
      return true;
    }

    default:
      console.warn(`[ConfigRouter] Unknown setConfig key: ${key}`);
      return false;
  }
}
