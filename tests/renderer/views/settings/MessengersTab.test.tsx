// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { MessengerConfig } from '../../../../src/lib/types/ai'
import { MessengersTab } from '../../../../src/renderer/views/settings/MessengersTab'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockConfigGet = vi.hoisted(() => vi.fn())
const mockConfigSet = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('../../../../src/renderer/bridge/config', () => ({
  config: { get: (...args: unknown[]) => mockConfigGet(...args) },
  configMutations: { set: (...args: unknown[]) => mockConfigSet(...args) },
}))

// ─── Helpers ────────────────────────────────────────────────────────────

function m(overrides: Partial<MessengerConfig> = {}): MessengerConfig {
  return {
    id: 'm1',
    provider: 'telegram',
    apiKey: '123',
    enabled: true,
    whitelist: [],
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
  })

  it('renders title and description after loading', async () => {
    render(<MessengersTab t={t} />)
    expect(await screen.findByText('Messengers')).toBeInTheDocument()
    expect(
      await screen.findByText('Configure messenger bots'),
    ).toBeInTheDocument()
  })

  it('shows empty state when no messengers', async () => {
    render(<MessengersTab t={t} />)
    expect(await screen.findByText('No bots configured')).toBeInTheDocument()
  })

  it('renders messenger provider badge', async () => {
    mockConfigGet.mockResolvedValue([m({ provider: 'telegram' })])
    render(<MessengersTab t={t} />)
    const matches = await screen.findAllByText('Telegram')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders multiple messengers', async () => {
    mockConfigGet.mockResolvedValue([
      m({ id: 'a', provider: 'telegram' }),
      m({ id: 'b', provider: 'discord' }),
    ])
    render(<MessengersTab t={t} />)
    const telegramMatches = await screen.findAllByText('Telegram')
    const discordMatches = await screen.findAllByText('Discord')
    expect(telegramMatches.length).toBeGreaterThanOrEqual(1)
    expect(discordMatches.length).toBeGreaterThanOrEqual(1)
  })

  it('loads config on mount', async () => {
    render(<MessengersTab t={t} />)
    await vi.waitFor(() => {
      expect(mockConfigGet).toHaveBeenCalledWith('messengers')
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
