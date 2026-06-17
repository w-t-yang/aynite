// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { ToolsTab } from '../../../../src/renderer/views/settings/ToolsTab'

const mockConfigGet = vi.hoisted(() => vi.fn())
vi.mock('../../../../src/renderer/bridge/config', () => ({
  config: { get: (...args: unknown[]) => mockConfigGet(...args) },
  configMutations: { set: vi.fn(() => Promise.resolve()) },
}))

const t = (key: string): string =>
  ({
    'tools.title': 'AI Tools',
    'tools.description': 'Configure AI tools',
    'tools.capabilities': 'Capabilities',
    'tools.capabilitiesDesc': 'Enable or disable AI tools',
    'tools.noTools': 'No tools available',
  })[key] || key

describe('ToolsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title after loading', async () => {
    mockConfigGet.mockResolvedValue({ active: {}, list: [] })
    const { container } = render(<ToolsTab t={t} />)
    await vi.waitFor(() => expect(container.textContent).toContain('AI Tools'))
  })

  it('shows empty state when no tools', async () => {
    mockConfigGet.mockResolvedValue({ active: {}, list: [] })
    const { container } = render(<ToolsTab t={t} />)
    await vi.waitFor(() =>
      expect(container.textContent).toContain('No tools available'),
    )
  })

  it('renders tool names', async () => {
    mockConfigGet.mockResolvedValue({
      active: { read: true },
      list: [{ id: 'read', name: 'Read Files', description: 'Read files' }],
    })
    const { container } = render(<ToolsTab t={t} />)
    await vi.waitFor(() =>
      expect(container.textContent).toContain('Read Files'),
    )
  })

  it('shows Restore Defaults when onRestore provided', async () => {
    mockConfigGet.mockResolvedValue({ active: {}, list: [] })
    const { container } = render(<ToolsTab onRestore={vi.fn()} t={t} />)
    await vi.waitFor(() =>
      expect(container.textContent).toContain('Restore Defaults'),
    )
  })

  it('hides Restore Defaults when onRestore omitted', async () => {
    mockConfigGet.mockResolvedValue({ active: {}, list: [] })
    const { container } = render(<ToolsTab t={t} />)
    await vi.waitFor(() =>
      expect(container.textContent).not.toContain('Restore Defaults'),
    )
  })
})
