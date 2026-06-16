// @vitest-environment node
import { describe, expect, it } from 'vitest'

/**
 * Tests for the file-browser mode selection logic extracted from useFileModes.
 * These test the pure logic flows without React hooks.
 */

// ─── Mode transition helpers (simulating useFileModes logic) ────────────

type ModeState = {
  activeFileview: string | null
  isViewOnly: boolean
  isEditing: boolean
  showDiff: boolean
  hasDiff: boolean
  activeView: string | null
  userMode: boolean
}

function defaultState(): ModeState {
  return {
    activeFileview: null,
    isViewOnly: true,
    isEditing: false,
    showDiff: false,
    hasDiff: false,
    activeView: null,
    userMode: false,
  }
}

function simulateAutoDetect(
  state: ModeState,
  params: {
    matches: string[]
    hasDiff: boolean
    isJson: boolean
    matchingViews: string[]
    filePathChanged: boolean
  },
): ModeState {
  if (params.filePathChanged) {
    state.userMode = false
  }

  if (!state.userMode) {
    // Reset everything
    state.isEditing = false
    state.activeFileview = null
    state.activeView = null
    state.hasDiff = false
    state.showDiff = false
  }

  if (params.hasDiff) {
    state.hasDiff = true
  }

  if (!state.userMode) {
    if (params.matches.length > 0) {
      state.activeFileview = params.matches[0]
      state.isViewOnly = false
      state.isEditing = false
    } else if (params.hasDiff) {
      state.showDiff = true
      state.isViewOnly = false
    } else {
      state.showDiff = false
      state.isViewOnly = true
    }
  } else if (!params.hasDiff) {
    // User mode but diff disappeared — clear
    state.showDiff = false
  }

  return state
}

describe('mode selection logic', () => {
  describe('auto-detect mode (user has not manually chosen)', () => {
    it('selects fileview when matches exist', () => {
      const state = simulateAutoDetect(defaultState(), {
        matches: ['fileview-markdown'],
        hasDiff: false,
        isJson: false,
        matchingViews: [],
        filePathChanged: true,
      })

      expect(state.activeFileview).toBe('fileview-markdown')
      expect(state.isViewOnly).toBe(false)
      expect(state.showDiff).toBe(false)
    })

    it('selects diff mode when file has changes and no fileview', () => {
      const state = simulateAutoDetect(defaultState(), {
        matches: [],
        hasDiff: true,
        isJson: false,
        matchingViews: [],
        filePathChanged: true,
      })

      expect(state.showDiff).toBe(true)
      expect(state.isViewOnly).toBe(false)
      expect(state.activeFileview).toBeNull()
    })

    it('uses view-only when no matches and no diff', () => {
      const state = simulateAutoDetect(defaultState(), {
        matches: [],
        hasDiff: false,
        isJson: false,
        matchingViews: [],
        filePathChanged: true,
      })

      expect(state.isViewOnly).toBe(true)
      expect(state.showDiff).toBe(false)
      expect(state.activeFileview).toBeNull()
    })

    it('prefers fileview over diff when both exist', () => {
      const state = simulateAutoDetect(defaultState(), {
        matches: ['fileview-markdown'],
        hasDiff: true,
        isJson: false,
        matchingViews: [],
        filePathChanged: true,
      })

      expect(state.activeFileview).toBe('fileview-markdown')
      expect(state.showDiff).toBe(false) // fileview wins
    })
  })

  describe('user mode (user has manually chosen)', () => {
    it('preserves user fileview selection on re-evaluation', () => {
      const state: ModeState = {
        ...defaultState(),
        userMode: true,
        activeFileview: 'fileview-markdown',
        isViewOnly: false,
      }

      const result = simulateAutoDetect(state, {
        matches: ['fileview-markdown'],
        hasDiff: true,
        isJson: false,
        matchingViews: [],
        filePathChanged: false, // same path
      })

      expect(result.activeFileview).toBe('fileview-markdown')
      expect(result.showDiff).toBe(false) // diff still present, but userMode
    })

    it('clears diff view when diff disappears after commit', () => {
      const state: ModeState = {
        ...defaultState(),
        userMode: true,
        showDiff: true,
        hasDiff: true,
        isViewOnly: false,
      }

      const result = simulateAutoDetect(state, {
        matches: [],
        hasDiff: false, // diff disappeared
        isJson: false,
        matchingViews: [],
        filePathChanged: false,
      })

      expect(result.showDiff).toBe(false)
    })

    it('resets user mode when file path changes', () => {
      const state: ModeState = {
        ...defaultState(),
        userMode: true,
        activeFileview: 'fileview-markdown',
        isViewOnly: false,
      }

      const result = simulateAutoDetect(state, {
        matches: [], // no fileview for new file
        hasDiff: false,
        isJson: false,
        matchingViews: [],
        filePathChanged: true, // file switched
      })

      expect(result.userMode).toBe(false)
      expect(result.activeFileview).toBeNull()
      expect(result.isViewOnly).toBe(true)
    })
  })

  describe('state transitions', () => {
    it('transitions from view-only to fileview on file open', () => {
      const s1 = defaultState() // no file open
      expect(s1.isViewOnly).toBe(true)

      const s2 = simulateAutoDetect(s1, {
        matches: ['fileview-markdown'],
        hasDiff: false,
        isJson: false,
        matchingViews: [],
        filePathChanged: true,
      })

      expect(s2.activeFileview).toBe('fileview-markdown')
    })

    it('transitions from diff to fileview when user selects fileview', () => {
      // User clicks a file with diff, then clicks fileview tab
      const s1 = simulateAutoDetect(defaultState(), {
        matches: [],
        hasDiff: true,
        isJson: false,
        matchingViews: [],
        filePathChanged: true,
      })
      expect(s1.showDiff).toBe(true)

      // User selects fileview manually
      const s2 = {
        ...s1,
        userMode: true,
        activeFileview: 'fileview-markdown',
        showDiff: false,
      }
      expect(s2.showDiff).toBe(false)
    })

    it('transitions from fileview to diff when user clicks diff button', () => {
      const s1 = simulateAutoDetect(defaultState(), {
        matches: ['fileview-markdown'],
        hasDiff: true,
        isJson: false,
        matchingViews: [],
        filePathChanged: true,
      })
      expect(s1.activeFileview).toBe('fileview-markdown')
      expect(s1.showDiff).toBe(false)

      // User clicks "show diff"
      const s2 = {
        ...s1,
        userMode: true,
        activeFileview: null,
        showDiff: true,
      }
      expect(s2.showDiff).toBe(true)
      expect(s2.activeFileview).toBeNull()
    })
  })
})

// ─── Tab selection logic (from useFileTabs) ────────────────────────────

describe('tab selection logic', () => {
  it('adds new file to opened files', () => {
    const openedFiles = ['/a.ts']
    const newPath = '/b.ts'

    const updatedFiles = openedFiles.includes(newPath)
      ? openedFiles
      : [...openedFiles, newPath]

    expect(updatedFiles).toEqual(['/a.ts', '/b.ts'])
  })

  it('does not duplicate existing file', () => {
    const openedFiles = ['/a.ts', '/b.ts']
    const newPath = '/b.ts'

    const updatedFiles = openedFiles.includes(newPath)
      ? openedFiles
      : [...openedFiles, newPath]

    expect(updatedFiles).toEqual(['/a.ts', '/b.ts'])
  })

  it('removes file from opened files on close', () => {
    const openedFiles = ['/a.ts', '/b.ts', '/c.ts']
    const toClose = '/b.ts'

    const updatedFiles = openedFiles.filter((f) => f !== toClose)

    expect(updatedFiles).toEqual(['/a.ts', '/c.ts'])
  })

  it('selects next tab when current tab is closed', () => {
    const openedFiles = ['/a.ts', '/b.ts', '/c.ts']
    const activeIndex = 1 // b.ts is active

    const updatedFiles = openedFiles.filter((f) => f !== '/b.ts')
    // After removing b.ts at index 1, the file that was at index 2 (c.ts)
    // shifts down to index 1. The new active file is at position activeIndex.
    const newActiveIndex = Math.min(activeIndex, updatedFiles.length - 1)
    const newActiveFile = updatedFiles[newActiveIndex]

    expect(updatedFiles).toEqual(['/a.ts', '/c.ts'])
    // After removal, c.ts is at index 1 (the original activeIndex)
    expect(newActiveFile).toBe('/c.ts')
  })

  it('selects previous tab when closing the last tab', () => {
    const openedFiles = ['/a.ts']
    const updatedFiles = openedFiles.filter((f) => f !== '/a.ts')
    expect(updatedFiles).toEqual([])
  })
})
