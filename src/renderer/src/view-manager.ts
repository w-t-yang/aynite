import { WorkspaceConfig } from '../../lib/constants/types'
import { ViewRequest } from '../../lib/constants/view'
import { ConfigKey } from '../../lib/constants/config'

/**
 * View Manager (Host Side)
 *
 * Implements the contract defined by ViewRequest.
 */
export const viewManager = {
  // Registry for dynamic listeners (e.g. from AppContext)
  listeners: new Map<ViewRequest, ((payload: any) => void)[]>(),

  registerListener(request: ViewRequest, callback: (payload: any) => void) {
    if (!this.listeners.has(request)) {
      this.listeners.set(request, [])
    }
    this.listeners.get(request)!.push(callback)
  },

  async [ViewRequest.GET_WORKSPACE_STATE](): Promise<{
    folders: string[]
    files: string[]
    activeFile?: string
  }> {
    const activeId = await window.aynite.getConfig(ConfigKey.ACTIVE_WORKSPACE)
    const workspaces = (await window.aynite.getConfig(ConfigKey.WORKSPACES)) as WorkspaceConfig[]
    const activeWorkspace = workspaces.find((w) => w.id === activeId)
    return {
      folders: activeWorkspace?.folders || [],
      files: activeWorkspace?.files || [],
      activeFile: activeWorkspace?.activeFile
    }
  },

  async [ViewRequest.SET_WORKSPACE_STATE](payload: { key: string; value: any }): Promise<boolean> {
    const activeId = await window.aynite.getConfig(ConfigKey.ACTIVE_WORKSPACE)
    const workspaces = (await window.aynite.getConfig(ConfigKey.WORKSPACES)) as WorkspaceConfig[]
    const activeWorkspace = workspaces.find((w) => w.id === activeId)

    if (activeWorkspace) {
      return window.aynite.setConfig(ConfigKey.WORKSPACE, {
        id: activeId,
        config: {
          ...activeWorkspace,
          [payload.key]: payload.value
        }
      })
    }
    return false
  },

  async [ViewRequest.GET_CONFIG](payload: { key: string; payload?: any }): Promise<any> {
    return window.aynite.getConfig(payload.key, payload.payload)
  },

  async [ViewRequest.SET_CONFIG](payload: { key: string; value: any }): Promise<any> {
    const result = await window.aynite.setConfig(payload.key, payload.value)
    return result
  },

  async [ViewRequest.SELECT_FOLDER](): Promise<string[] | null> {
    return window.aynite.selectFolder()
  },

  async [ViewRequest.LIST_FOLDER](path: string): Promise<any> {
    return window.aynite.listFolder(path)
  },

  async [ViewRequest.OPEN_FILE](_path: string): Promise<boolean> {
    // Note: Actual implementation is usually provided via a listener in AppContext
    return true
  },

  async [ViewRequest.CREATE](payload: { path: string; isDirectory: boolean }): Promise<boolean> {
    return window.aynite.createFile(payload.path, payload.isDirectory)
  },

  async [ViewRequest.MOVE](payload: { oldPath: string; newPath: string }): Promise<boolean> {
    return window.aynite.move(payload.oldPath, payload.newPath)
  },

  async [ViewRequest.REMOVE](path: string): Promise<boolean> {
    return window.aynite.remove(path)
  },

  async [ViewRequest.COPY](path: string): Promise<boolean> {
    return window.aynite.copy(path)
  },

  async [ViewRequest.PASTE](destDir: string): Promise<boolean> {
    return window.aynite.paste(destDir)
  },

  async [ViewRequest.GET_FILES](path: string): Promise<any> {
    return window.aynite.getFiles(path)
  },

  async [ViewRequest.READ_FILE](path: string): Promise<any> {
    return window.aynite.readFile(path)
  },

  async [ViewRequest.AI_CHAT](payload: any): Promise<any> {
    return window.aynite.aiChat(payload)
  },

  async [ViewRequest.GET_MERGED_SYSTEM_PROMPT](payload: {
    globalFiles?: string[]
    agentFiles?: string[]
  }): Promise<any> {
    return window.aynite.getMergedSystemPrompt(payload)
  },

  async [ViewRequest.LIST_CHAT_LOGS](): Promise<any> {
    return window.aynite.listChatLogs()
  },

  async [ViewRequest.SAVE_CHAT_LOG](payload: { id: string; messages: any[] }): Promise<any> {
    return window.aynite.saveChatLog(payload)
  },

  async [ViewRequest.LOAD_CHAT_LOG](payload: { id: string; date: string }): Promise<any> {
    return window.aynite.loadChatLog(payload)
  },

  async [ViewRequest.RUN_DIRECT_COMMAND](payload: any): Promise<any> {
    return window.aynite.runDirectCommand(payload)
  },

  async [ViewRequest.RESPOND_TO_APPROVAL](payload: {
    id: string
    approved: boolean
  }): Promise<void> {
    return window.aynite.respondToAiApproval(payload.id, payload.approved)
  },

  async handleRequest(request: ViewRequest, payload: any): Promise<any> {
    // 1. Execute the default handler if it exists
    const handler = (this as any)[request]
    let result: any
    if (typeof handler === 'function') {
      result = await (handler as any).call(this, payload)
    }

    // 2. Notify all listeners
    // Note: We notify listeners AFTER the handler completes (especially for SET_CONFIG)
    const requestListeners = this.listeners.get(request)
    if (requestListeners) {
      requestListeners.forEach((listener) => listener(payload))
    }

    return result
  }
}
