// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { MessengerConfig } from '../../../../src/lib/types/ai'
import { MessengersTab } from '../../../../src/renderer/views/settings/MessengersTab'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockConfigGet = vi.hoisted(() => vi.fn())
const mockWorkspaceList = vi.hoisted(() => vi.fn())

vi.mock('../../../../src/renderer/bridge/config', () => ({
  config: { get: (...args: unknown[]) => mockConfigGet(...args) },
  configMutations: { set: vi.fn(() => Promise.resolve()) },
}))

vi.mock('../../../../src/renderer/bridge/workspace', () => ({
  workspace: { list: (...args: unknown[]) => mockWorkspaceList(...args) },
}))

// ─── Helpers ────────────────────────────────────────────────────────────

function m(overrides: Partial<MessengerConfig> = {}): MessengerConfig {
  return {
    id: 'm1',
    name: 'My Bot',
    type: 'telegram',
    apiKey: '123',
    workspace: 'ws1',
    enabled: true,
    ...overrides,
  }
}

const t = (key: string): string =>
  ({
    'messengers.title': 'Messengers',
    'messengers.description': 'Configure messenger bots',
    'messengers.bots': 'Bots',
    'messengers.addBot': 'Add Bot',
    'messengers.noBots': 'No bots configured',
  })[key] || key

describe('MessengersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfigGet.mockResolvedValue([])
    mockWorkspaceList.mockResolvedValue({ list: ['ws1'] })
  })

  it('renders title and description after loading', async () => {
    render(<MessengersTab t={t} />)
    expect(await screen.findByText('Messengers')).toBeInTheDocument()
    expect(
      await screen.findByText('Configure messenger bots'),
    ).toBeInTheDocument()
  })

  it('renders messenger names in input fields', async () => {
    mockConfigGet.mockResolvedValue([m({ name: 'My Telegram Bot' })])
    render(<MessengersTab t={t} />)
    expect(
      await screen.findByDisplayValue('My Telegram Bot'),
    ).toBeInTheDocument()
  })

  it('shows empty state when no messengers', async () => {
    mockConfigGet.mockResolvedValue([])
    render(<MessengersTab t={t} />)
    expect(await screen.findByText('No bots configured')).toBeInTheDocument()
  })

  it('renders multiple messengers', async () => {
    mockConfigGet.mockResolvedValue([
      m({ id: 'a', name: 'Bot A' }),
      m({ id: 'b', name: 'Bot B' }),
    ])
    render(<MessengersTab t={t} />)
    expect(await screen.findByDisplayValue('Bot A')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Bot B')).toBeInTheDocument()
  })

  it('loads config and workspaces on mount', async () => {
    render(<MessengersTab t={t} />)
    await vi.waitFor(() => {
      expect(mockConfigGet).toHaveBeenCalledWith('messengers')
      expect(mockWorkspaceList).toHaveBeenCalled()
    })
  })

  it('shows Restore Defaults when onRestore provided', async () => {
    mockConfigGet.mockResolvedValue([m()])
    const { container } = render(<MessengersTab onRestore={vi.fn()} t={t} />)
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Restore Defaults')
    })
  })

  it('hides Restore Defaults when onRestore omitted', async () => {
    mockConfigGet.mockResolvedValue([m()])
    const { container } = render(<MessengersTab t={t} />)
    await vi.waitFor(() => {
      expect(container.textContent).not.toContain('Restore Defaults')
    })
  })
})
