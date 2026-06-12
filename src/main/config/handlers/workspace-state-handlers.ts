/**
 * Handlers for workspace-scoped state keys (activeFile, openedFiles, sessionId, etc.).
 * These resolve the workspace name from the calling window's winId.
 */
import { AppEvents } from '../../../lib/constants/app'
import {
  deleteSession,
  getMergedSystemPrompt,
  listSessions,
  loadSession,
  saveSession,
} from '../../ai'
import { sendToWindow } from '../../window'
import { getWindowWorkspace } from '../../window-state'
import {
  getWorkspaceState,
  getWorkspacesList,
  saveWorkspaceState,
  updateTileData,
} from '../../workspace'
import type { ConfigHandler } from '../handler-registry'

/** Resolve workspace name from winId or fallback to global config */
async function resolveWorkspace(winId?: number): Promise<string> {
  if (winId && winId > 0) {
    return await getWindowWorkspace(winId)
  }
  const wsConfig = await getWorkspacesList()
  return wsConfig.active
}

export const workspaceStateHandlers: ConfigHandler = (() => ({
  get: async (key: string, payload: any, winId?: number) => {
    const workspaceName = await resolveWorkspace(winId)
    switch (key) {
      case 'chatLogs':
        return await listSessions(workspaceName)
      case 'load-chat-log': {
        if (payload?.id && payload.date) {
          return await loadSession(workspaceName, payload.id, payload.date)
        }
        return null
      }
      case 'merged-system-prompt': {
        return await getMergedSystemPrompt(
          payload?.globalFiles,
          payload?.agentFiles,
        )
      }
      case 'activeFile': {
        const state = await getWorkspaceState(workspaceName)
        return state.activeFile || null
      }
      case 'openedFiles': {
        const state = await getWorkspaceState(workspaceName)
        return state.files || []
      }
      case 'activeSessionId': {
        const state = await getWorkspaceState(workspaceName)
        return state.activeSessionId || null
      }
      default:
        return null
    }
  },
  set: async (key: string, payload: any, winId?: number) => {
    const workspaceName = await resolveWorkspace(winId)
    switch (key) {
      case 'save-chat-log': {
        if (payload?.id && payload.messages) {
          await saveSession(workspaceName, payload.id, payload.messages)
        }
        return true
      }
      case 'activeFile': {
        const filePath = payload as string
        const state = await getWorkspaceState(workspaceName)
        const files = state.files || []
        const updatedFiles =
          filePath && !files.includes(filePath)
            ? [...files, filePath]
            : filePath === null
              ? []
              : files
        await saveWorkspaceState(workspaceName, {
          activeFile: filePath,
          files: updatedFiles,
        })
        return true
      }
      case 'openedFiles': {
        const files = payload as string[]
        await saveWorkspaceState(workspaceName, { files })
        return true
      }
      case 'activeSessionId': {
        await saveWorkspaceState(workspaceName, {
          activeSessionId: payload,
        })
        if (winId && winId > 0) {
          sendToWindow(winId, AppEvents.ACTIVE_SESSION_CHANGED, {
            id: payload,
          })
        }
        return true
      }
      case 'tile-data': {
        const { tileId, data } = payload as {
          tileId: string
          data: Record<string, any>
        }
        await updateTileData(tileId, data)
        if (winId && winId > 0) {
          sendToWindow(winId, AppEvents.WORKSPACE_UPDATED, { id: tileId })
        }
        return true
      }
      case 'session-delete': {
        const id = payload as string
        await deleteSession(workspaceName, id)
        if (winId && winId > 0) {
          sendToWindow(winId, AppEvents.SESSION_DELETED, { id })
        }
        return true
      }
      default:
        return false
    }
  },
}))()
