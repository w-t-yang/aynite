/**
 * approval-queue.test — Tests for AI Approval request queue management.
 *
 * Critical invariant: requestAiApproval MUST use broadcastAppEvent
 * (not sendAppEvent) so the approval event reaches ALL windows, not
 * just wins[0]. The deprecated sendAppEvent only targets the first
 * window, which means iframes/secondary windows never see the event.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────
// Use vi.hoisted so these exist before vi.mock factories are hoisted

const mockIpcMainOn = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    on: mockIpcMainOn,
  },
}))

const mockBroadcastAppEvent = vi.hoisted(() => vi.fn())
const mockSendAppEvent = vi.hoisted(() => vi.fn())
const mockSendAppOperation = vi.hoisted(() => vi.fn())

vi.mock('../../src/main/ipc-utils', () => ({
  broadcastAppEvent: mockBroadcastAppEvent,
  sendAppEvent: mockSendAppEvent,
  sendAppOperation: mockSendAppOperation,
}))

// ─── Import after mocks ────────────────────────────────────────────────

import { AppEvents } from '../../src/lib/constants/app'
import {
  AiEventChannels,
  AppOperationChannel,
} from '../../src/lib/constants/ipc-channels'
import {
  requestAiApproval,
  setupApprovalListeners,
} from '../../src/main/approval-queue'

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Helper: install the IPC response handler and return it so tests can
 * simulate approval/rejection responses to unblock the queue.
 */
function installResponseHandler(): (id: string, approved: boolean) => void {
  let responseHandler:
    | ((_e: unknown, r: { id: string; approved: boolean }) => void)
    | null = null
  mockIpcMainOn.mockImplementation(
    (channel: string, handler: typeof responseHandler) => {
      if (channel === AiEventChannels.APPROVAL_RESPONSE) {
        responseHandler = handler
      }
    },
  )
  setupApprovalListeners()
  return (id: string, approved: boolean) => {
    responseHandler?.(null, { id, approved })
  }
}

/**
 * Helper: get the approval ID from the last broadcastAppEvent call.
 */
function lastApprovalId(): string {
  const calls = mockBroadcastAppEvent.mock.calls
  return calls[calls.length - 1][1].id
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('approval-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── requestAiApproval ─────────────────────────────────────────────

  describe('requestAiApproval', () => {
    it('calls broadcastAppEvent (not sendAppEvent) with AI_APPROVAL_REQUEST', () => {
      // Install response handler so we can clean up after the test
      const respond = installResponseHandler()

      // Act: send a request
      const promise = requestAiApproval({ command: 'ls -la', cwd: '/tmp' })

      // Assert: broadcastAppEvent was called with the right payload
      expect(mockBroadcastAppEvent).toHaveBeenCalledTimes(1)
      expect(mockBroadcastAppEvent).toHaveBeenCalledWith(
        AppEvents.AI_APPROVAL_REQUEST,
        expect.objectContaining({
          command: 'ls -la',
          cwd: '/tmp',
          id: expect.any(String),
        }),
      )

      // CRITICAL ASSERTION: sendAppEvent must NOT be called
      // This catches a regression where sendAppEvent (wins[0] only)
      // is used instead of broadcastAppEvent (all windows)
      expect(mockSendAppEvent).not.toHaveBeenCalled()

      // Cleanup: unblock queue so state doesn't leak
      respond(lastApprovalId(), true)
      return promise.catch(() => {})
    })

    it('generates a unique approval ID per request', async () => {
      const respond = installResponseHandler()

      // First request
      const p1 = requestAiApproval({ command: 'a', cwd: '/x' })
      const id1 = lastApprovalId()

      // Unblock first request so second can be processed
      respond(id1, true)
      await p1

      // Second request
      const p2 = requestAiApproval({ command: 'b', cwd: '/y' })
      const id2 = lastApprovalId()

      expect(id1).not.toBe(id2)
      expect(id1).toBeTruthy()
      expect(id2).toBeTruthy()

      respond(id2, true)
      await p2
    })

    it('returns true when approved and false when rejected', async () => {
      const respond = installResponseHandler()

      // Send two requests and resolve them with different outcomes
      const approvedPromise = requestAiApproval({ command: 'ok', cwd: '/' })
      const rejectedPromise = requestAiApproval({ command: 'no', cwd: '/' })

      // Approve first
      const id1 = lastApprovalId()
      respond(id1, true)

      // Reject second
      const id2 = lastApprovalId()
      respond(id2, false)

      await expect(approvedPromise).resolves.toBe(true)
      await expect(rejectedPromise).resolves.toBe(false)
    })
  })

  // ─── setupApprovalListeners ────────────────────────────────────────

  describe('setupApprovalListeners', () => {
    it('registers handlers for APPROVAL_RESPONSE and AppOperationChannel', () => {
      setupApprovalListeners()

      expect(mockIpcMainOn).toHaveBeenCalledWith(
        AiEventChannels.APPROVAL_RESPONSE,
        expect.any(Function),
      )
      expect(mockIpcMainOn).toHaveBeenCalledWith(
        AppOperationChannel,
        expect.any(Function),
      )
    })
  })

  // ─── Queue ordering ────────────────────────────────────────────────

  describe('queue ordering', () => {
    it('processes requests sequentially (one at a time)', async () => {
      const respond = installResponseHandler()

      // Request 1
      const p1 = requestAiApproval({ command: 'first', cwd: '/a' })
      expect(mockBroadcastAppEvent).toHaveBeenCalledTimes(1)

      // Request 2 — should be queued, NOT broadcast yet
      const p2 = requestAiApproval({ command: 'second', cwd: '/b' })
      expect(mockBroadcastAppEvent).toHaveBeenCalledTimes(1)

      // Resolve first request
      respond(lastApprovalId(), true)
      await expect(p1).resolves.toBe(true)

      // Now second request should be broadcast
      expect(mockBroadcastAppEvent).toHaveBeenCalledTimes(2)
      expect(lastApprovalId()).toBeTruthy()
      expect(mockBroadcastAppEvent.mock.calls[1][1]).toMatchObject({
        command: 'second',
        cwd: '/b',
      })

      // Resolve second request
      respond(lastApprovalId(), false)
      await expect(p2).resolves.toBe(false)
    })
  })
})
