import { ConfigKey } from '../config'
import type { KeybindingConfig, WorkspaceConfig } from '../types'

class AyniteConfig {
  // Workspace Config
  async getWorkspaces(): Promise<WorkspaceConfig[]> {
    return window.aynite.getConfig(ConfigKey.WORKSPACES)
  }

  async getActiveWorkspace(): Promise<string> {
    return window.aynite.getConfig(ConfigKey.ACTIVE_WORKSPACE)
  }

  async setActiveWorkspace(id: string): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.ACTIVE_WORKSPACE, id)
  }

  async createWorkspace(name: string): Promise<any> {
    return window.aynite.createWorkspace(name)
  }

  async saveWorkspace(config: WorkspaceConfig): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.WORKSPACE, {
      id: config.id,
      config,
    })
  }

  async getActiveFile(): Promise<string | null> {
    return window.aynite.getConfig(ConfigKey.ACTIVE_FILE)
  }

  // AI
  async getAI(): Promise<any> {
    return window.aynite.getConfig(ConfigKey.AI)
  }

  async setAI(config: any): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.AI, config)
  }

  // Agents & Prompts
  async getAgents(): Promise<any> {
    return window.aynite.getConfig(ConfigKey.AGENTS)
  }

  async setAgents(config: any): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.AGENTS, config)
  }

  async getPrompts(): Promise<any> {
    return window.aynite.getConfig(ConfigKey.PROMPTS)
  }

  async setPrompts(config: any): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.PROMPTS, config)
  }

  // Skills & Commands
  async getSkills(): Promise<any> {
    return window.aynite.getConfig(ConfigKey.SKILLS)
  }

  async setSkills(config: any): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.SKILLS, config)
  }

  async getCommands(): Promise<any> {
    return window.aynite.getConfig(ConfigKey.COMMANDS)
  }

  async setCommands(config: any): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.COMMANDS, config)
  }

  // Tools
  async getTools(): Promise<any> {
    return window.aynite.getConfig(ConfigKey.TOOLS)
  }

  async setTools(config: any): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.TOOLS, config)
  }

  // Keybindings
  async getKeybindings(): Promise<KeybindingConfig> {
    return window.aynite.getConfig(ConfigKey.KEYBINDINGS)
  }

  async setKeybindings(config: any): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.KEYBINDINGS, config)
  }

  // Themes
  async getThemes(): Promise<any[]> {
    return window.aynite.getConfig(ConfigKey.THEMES)
  }

  async getActiveThemeId(): Promise<string> {
    return window.aynite.getConfig(ConfigKey.ACTIVE_THEME)
  }

  async setActiveTheme(id: string): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.ACTIVE_THEME, id)
  }

  async getTheme(id: string): Promise<any> {
    return window.aynite.getConfig(ConfigKey.THEME, id)
  }

  async saveTheme(id: string, theme: any): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.THEME, { id, theme })
  }

  async getAppVersion(): Promise<string> {
    return window.aynite.getConfig(ConfigKey.VERSION)
  }

  async getSystemFonts(): Promise<string[]> {
    return window.aynite.getSystemFonts()
  }

  async checkForUpdates(): Promise<void> {
    return window.aynite.checkForUpdates()
  }
}

export const ayniteConfig = new AyniteConfig()
