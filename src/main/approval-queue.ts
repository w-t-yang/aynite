/**
 * approval-queue — AI Approval request queue management.
 *
 * Manages the approval request lifecycle: queuing, sending to renderer,
 * and processing responses. Only one approval UI is shown at a time.
 * Imports sendAppEvent from ipc-utils for renderer communication.
 */

import { ipcMain } from 'electron'
import { AppEvents } from '../lib/constants/app'
import {
  AiEventChannels,
  AppOperationChannel,
} from '../lib/constants/ipc-channels'
import { sendAppEvent, sendAppOperation } from './ipc-utils'

// ─── Module-level state ───────────────────────────────────────────────────

const pendingApprovals = new Map<string, (approved: boolean) => void>()
const approvalQueue: Array<{
  id: string
  data: { command: string; cwd: string }
  resolve: (approved: boolean) => void
}> = []
let isProcessingApproval = false

// ─── Internal ─────────────────────────────────────────────────────────────

/**
 * Processes the next queued approval request if there is one and no request
 * is currently active.
 */
function processApprovalQueue() {
  if (isProcessingApproval || approvalQueue.length === 0) return

  isProcessingApproval = true
  const next = approvalQueue.shift()
  if (!next) return

  pendingApprovals.set(next.id, next.resolve)
  sendAppEvent(AppEvents.AI_APPROVAL_REQUEST, {
    id: next.id,
    ...next.data,
  })
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Sends an approval request to the renderer and waits for the response.
 * Requests are queued so only one approval UI is shown at a time.
 */
export async function requestAiApproval(data: {
  command: string
  cwd: string
}): Promise<boolean> {
  const approvalId = `approve_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  return new Promise((resolve) => {
    approvalQueue.push({ id: approvalId, data, resolve })
    processApprovalQueue()
  })
}

/**
 * Set up IPC listeners for approval responses.
 * Called once during app initialization (from setupSystemIpc or similar).
 */
export function setupApprovalListeners(): void {
  ipcMain.on(
    AiEventChannels.APPROVAL_RESPONSE,
    (_event, response: { id: string; approved: boolean }) => {
      const resolve = pendingApprovals.get(response.id)
      if (resolve) {
        resolve(response.approved)
        pendingApprovals.delete(response.id)
      }
      isProcessingApproval = false
      processApprovalQueue()
    },
  )

  ipcMain.on(
    AppOperationChannel,
    (_event, operation: string, data?: unknown) => {
      sendAppOperation(operation, data)
    },
  )
}
