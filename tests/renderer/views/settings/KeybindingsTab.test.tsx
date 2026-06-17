// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { KeybindingsTab } from '../../../../src/renderer/views/settings/KeybindingsTab'

const mockConfigGet = vi.hoisted(() => vi.fn())
vi.mock('../../../../src/renderer/bridge/config', () => ({
  config: { get: (...args: unknown[]) => mockConfigGet(...args) },
  configMutations: { set: vi.fn(() => Promise.resolve()) },
}))

type Keybinding = {
  ctrl?: boolean
  meta?: boolean
  alt?: boolean
  shift?: boolean
  key: string
}
function formatKeybinding(kb?: Keybinding): string {
  if (!kb) return ''
  const parts: string[] = []
  if (kb.ctrl) parts.push('Ctrl')
  if (kb.meta) parts.push('Cmd')
  if (kb.alt) parts.push('Alt')
  if (kb.shift) parts.push('Shift')
  if (kb.key) parts.push(kb.key.toUpperCase())
  return parts.join('+')
}

const t = (key: string): string =>
  ({
    'keybindings.title': 'Keybindings',
    'keybindings.description': 'Configure keyboard shortcuts',
    'keybindings.application.title': 'Application',
    'keybindings.application.description': 'App-wide shortcuts',
    'keybindings.cycleTile': 'Cycle Tile',
    'keybindings.splitVertical': 'Split Vertical',
    'keybindings.splitHorizontal': 'Split Horizontal',
    'keybindings.closeTile': 'Close Tile',
    'keybindings.refreshTile': 'Refresh Tile',
  })[key] || key

describe('formatKeybinding', () => {
  it('returns empty for undefined', () =>
    expect(formatKeybinding(undefined)).toBe(''))
  it('formats Ctrl+Key', () =>
    expect(formatKeybinding({ ctrl: true, key: 's' })).toBe('Ctrl+S'))
  it('formats Cmd+Shift+Key', () =>
    expect(formatKeybinding({ meta: true, shift: true, key: 'p' })).toBe(
      'Cmd+Shift+P',
    ))
})

const defaultKeybindings = {
  app: {
    TILE_CYCLE: { key: 'Tab', ctrl: true },
    TILE_CLOSE: { key: 'w', ctrl: true },
  },
  view: {},
}

describe('KeybindingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title after loading', async () => {
    mockConfigGet.mockResolvedValue(defaultKeybindings)
    const { container } = render(<KeybindingsTab t={t} />)
    await vi.waitFor(() =>
      expect(container.textContent).toContain('Keybindings'),
    )
  })

  it('renders labels', async () => {
    mockConfigGet.mockResolvedValue(defaultKeybindings)
    const { container } = render(<KeybindingsTab t={t} />)
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Cycle Tile')
      expect(container.textContent).toContain('Close Tile')
    })
  })

  it('renders keybinding values', async () => {
    mockConfigGet.mockResolvedValue(defaultKeybindings)
    const { container } = render(<KeybindingsTab t={t} />)
    await vi.waitFor(() => {
      const inputs = container.querySelectorAll('input')
      const values = Array.from(inputs).map(
        (i) => (i as HTMLInputElement).value,
      )
      expect(values).toContain('Ctrl+TAB')
      expect(values).toContain('Ctrl+W')
    })
  })

  it('shows Restore Defaults when onRestore provided', async () => {
    mockConfigGet.mockResolvedValue(defaultKeybindings)
    const { container } = render(<KeybindingsTab onRestore={vi.fn()} t={t} />)
    await vi.waitFor(() =>
      expect(container.textContent).toContain('Restore Defaults'),
    )
  })

  it('hides Restore Defaults when onRestore omitted', async () => {
    mockConfigGet.mockResolvedValue(defaultKeybindings)
    const { container } = render(<KeybindingsTab t={t} />)
    await vi.waitFor(() =>
      expect(container.textContent).not.toContain('Restore Defaults'),
    )
  })
})
