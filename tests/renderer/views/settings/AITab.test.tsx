// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { AIProvider } from '../../../../src/renderer/shared/lib/types'
import { AITab } from '../../../../src/renderer/views/settings/AITab'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockConfigGet = vi.hoisted(() => vi.fn())
vi.mock('../../../../src/renderer/bridge/config', () => ({
  config: { get: (...args: unknown[]) => mockConfigGet(...args) },
  configMutations: { set: vi.fn(() => Promise.resolve()) },
}))

// ─── Helpers ────────────────────────────────────────────────────────────

function p(overrides: Partial<AIProvider> = {}): AIProvider {
  return {
    id: 'p1',
    name: 'My Provider',
    provider: 'openai',
    baseUrl: 'https://api.openai.com',
    apiKey: 'sk-xxx',
    model: 'gpt-4',
    ...overrides,
  }
}

const t = (key: string): string =>
  ({
    'ai.title': 'AI Providers',
    'ai.description': 'Configure your AI providers',
    'ai.providers': 'Providers',
    'ai.addProvider': 'Add Provider',
    'ai.newProvider': 'New Provider',
    'ai.noProviders': 'No providers configured',
  })[key] || key

// ─── Tests ──────────────────────────────────────────────────────────────

describe('AITab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Rendering ──────────────────────────────────────────────────────

  it('renders title and description after loading', async () => {
    mockConfigGet.mockResolvedValue({ activeId: 'p1', providers: [p()] })
    render(<AITab t={t} />)

    expect(await screen.findByText('AI Providers')).toBeInTheDocument()
    expect(
      await screen.findByText('Configure your AI providers'),
    ).toBeInTheDocument()
  })

  it('renders provider name in an input field', async () => {
    mockConfigGet.mockResolvedValue({
      activeId: 'p1',
      providers: [p({ name: 'Custom Name' })],
    })
    render(<AITab t={t} />)

    expect(await screen.findByDisplayValue('Custom Name')).toBeInTheDocument()
  })

  it('renders provider fields (model, baseUrl)', async () => {
    mockConfigGet.mockResolvedValue({
      activeId: 'p1',
      providers: [p({ model: 'gpt-5', baseUrl: 'https://custom.url' })],
    })
    render(<AITab t={t} />)

    expect(await screen.findByDisplayValue('gpt-5')).toBeInTheDocument()
    expect(
      await screen.findByDisplayValue('https://custom.url'),
    ).toBeInTheDocument()
  })

  it('renders multiple providers', async () => {
    mockConfigGet.mockResolvedValue({
      activeId: 'a',
      providers: [
        p({ id: 'a', name: 'First' }),
        p({ id: 'b', name: 'Second' }),
      ],
    })
    render(<AITab t={t} />)

    expect(await screen.findByDisplayValue('First')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Second')).toBeInTheDocument()
  })

  // ─── Empty state ────────────────────────────────────────────────────

  it('shows empty state when no providers', async () => {
    mockConfigGet.mockResolvedValue({ activeId: '', providers: [] })
    render(<AITab t={t} />)

    expect(
      await screen.findByText('No providers configured'),
    ).toBeInTheDocument()
  })

  it('calls config.get on mount', async () => {
    mockConfigGet.mockResolvedValue({ activeId: '', providers: [] })
    render(<AITab t={t} />)

    await vi.waitFor(() => {
      expect(mockConfigGet).toHaveBeenCalledWith('ai')
    })
  })

  // ─── Data loading ──────────────────────────────────────────────────

  it('loads data from config.get on mount', async () => {
    mockConfigGet.mockResolvedValue({ activeId: 'p1', providers: [p()] })
    render(<AITab t={t} />)
    await vi.waitFor(() => {
      expect(mockConfigGet).toHaveBeenCalledWith('ai')
    })
  })

  // ─── Restore defaults ───────────────────────────────────────────────

  it('shows Restore Defaults when onRestore provided', async () => {
    mockConfigGet.mockResolvedValue({ activeId: 'p1', providers: [p()] })
    const { container } = render(<AITab onRestore={vi.fn()} t={t} />)

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Restore Defaults')
    })
  })

  it('hides Restore Defaults when onRestore omitted', async () => {
    mockConfigGet.mockResolvedValue({ activeId: 'p1', providers: [p()] })
    const { container } = render(<AITab t={t} />)

    await vi.waitFor(() => {
      expect(container.textContent).not.toContain('Restore Defaults')
    })
  })
})
