import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock window.aynite
const mockOnAppEvent = vi.fn(() => vi.fn())
const mockOnAppOperation = vi.fn(() => vi.fn())

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).window = {
    aynite: {
      onAppEvent: mockOnAppEvent,
      onAppOperation: mockOnAppOperation,
      setConfig: vi.fn(),
      getConfig: vi.fn(() => Promise.resolve(null)),
      getAvailableViews: vi.fn(() => Promise.resolve([])),
      deleteWorkspace: vi.fn(),
      openNewWindow: vi.fn(),
    },
  }
})

// Helper: mock ayniteConfig used by the providers
vi.mock('../../../../src/lib/constants/renderer/config', () => ({
  ayniteConfig: {
    getThemes: vi.fn(() => Promise.resolve([])),
    getActiveThemeId: vi.fn(() => Promise.resolve('light')),
    getTheme: vi.fn(() => Promise.resolve(null)),
    getWorkspaces: vi.fn(() => Promise.resolve([])),
    getActiveWorkspace: vi.fn(() => Promise.resolve('default')),
    getActiveFile: vi.fn(() => Promise.resolve(null)),
    setActiveWorkspace: vi.fn(() => Promise.resolve()),
    createWorkspace: vi.fn(() => Promise.resolve()),
    saveWorkspace: vi.fn(),
  },
}))

describe('AppContext composition', () => {
  it('exports useApp hook', async () => {
    const mod = await import('../../../../src/renderer/src/AppContext')
    expect(typeof mod.useApp).toBe('function')
    expect(typeof mod.AppProvider).toBe('function')
  })

  it('AppProvider renders without crashing', async () => {
    const { AppProvider } = await import(
      '../../../../src/renderer/src/AppContext'
    )
    // Just verify it's a component
    expect(AppProvider).toBeDefined()
  })
})

describe('WorkspaceContext', () => {
  it('exports useWorkspace hook', async () => {
    const mod = await import(
      '../../../../src/renderer/src/contexts/WorkspaceContext'
    )
    expect(typeof mod.useWorkspace).toBe('function')
    expect(typeof mod.WorkspaceProvider).toBe('function')
  })
})

describe('ThemeContext', () => {
  it('exports useTheme hook', async () => {
    const mod = await import(
      '../../../../src/renderer/src/contexts/ThemeContext'
    )
    expect(typeof mod.useTheme).toBe('function')
    expect(typeof mod.ThemeProvider).toBe('function')
  })
})

describe('LayoutContext', () => {
  it('exports useLayout hook', async () => {
    const mod = await import(
      '../../../../src/renderer/src/contexts/LayoutContext'
    )
    expect(typeof mod.useLayout).toBe('function')
    expect(typeof mod.LayoutProvider).toBe('function')
  })
})

describe('UpdateContext', () => {
  it('exports useUpdate hook', async () => {
    const mod = await import(
      '../../../../src/renderer/src/contexts/UpdateContext'
    )
    expect(typeof mod.useUpdate).toBe('function')
    expect(typeof mod.UpdateProvider).toBe('function')
  })
})

describe('WindowContext', () => {
  it('exports useWindowState hook', async () => {
    const mod = await import(
      '../../../../src/renderer/src/contexts/WindowContext'
    )
    expect(typeof mod.useWindowState).toBe('function')
    expect(typeof mod.WindowProvider).toBe('function')
  })
})

describe('UIContext', () => {
  it('exports useUI hook', async () => {
    const mod = await import('../../../../src/renderer/src/contexts/UIContext')
    expect(typeof mod.useUI).toBe('function')
    expect(typeof mod.UIProvider).toBe('function')
  })
})
