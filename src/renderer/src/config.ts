import { WorkspaceConfig, KeybindingConfig, View } from '../../lib/constants/types'
import { ConfigKey } from '../../lib/constants/config'

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

  async saveWorkspace(config: WorkspaceConfig): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.WORKSPACE, { id: config.id, config })
  }

  // Keybindings
  async getKeybindings(): Promise<KeybindingConfig> {
    return window.aynite.getConfig(ConfigKey.KEYBINDINGS)
  }

  async saveKeybindings(config: KeybindingConfig): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.KEYBINDINGS, config)
  }

  // Views
  async getViews(): Promise<View[]> {
    return window.aynite.getConfig(ConfigKey.VIEWS)
  }

  // Themes
  async getThemes(): Promise<any[]> {
    return window.aynite.getConfig(ConfigKey.THEMES)
  }

  async getActiveThemeId(): Promise<string> {
    return window.aynite.getConfig(ConfigKey.ACTIVE_THEME)
  }

  async getTheme(id: string): Promise<any> {
    return window.aynite.getConfig(ConfigKey.THEME, id)
  }

  async saveTheme(id: string, theme: any): Promise<boolean> {
    return window.aynite.setConfig(ConfigKey.THEME, { id, theme })
  }
}

export const ayniteConfig = new AyniteConfig()
