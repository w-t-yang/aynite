// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { AgentsTab } from '../../../../src/renderer/views/settings/AgentsTab'

const mockConfigGet = vi.hoisted(() => vi.fn())
const mockGetMergedPrompt = vi.hoisted(() => vi.fn())
const mockSelectFile = vi.hoisted(() => vi.fn())

vi.mock('../../../../src/renderer/bridge/config', () => ({
  config: { get: (...args: unknown[]) => mockConfigGet(...args) },
  configMutations: { set: vi.fn(() => Promise.resolve()) },
}))
vi.mock('../../../../src/renderer/bridge/ai', () => ({
  ai: {
    getMergedSystemPrompt: (...args: unknown[]) => mockGetMergedPrompt(...args),
  },
}))
vi.mock('../../../../src/renderer/bridge/system', () => ({
  system: { selectFile: (...args: unknown[]) => mockSelectFile(...args) },
}))

const t = (key: string): string =>
  ({
    'agents.title': 'Agents',
    'agents.description': 'Configure AI agents',
    'agents.globalPrompts.title': 'Global Prompts',
    'agents.globalPrompts.description': 'Global prompt files',
    'agents.globalPrompts.addPrompt': 'Add Prompt',
    'agents.globalPrompts.noPrompts': 'No prompts configured',
    'agents.profiles.title': 'Agent Profiles',
    'agents.profiles.description': 'Configure agent profiles',
    'agents.profiles.addAgent': 'Add Agent',
    'agents.promptPreview': 'Prompt Preview',
    'agents.noPreview': 'No preview',
  })[key] || key

describe('AgentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfigGet.mockImplementation((key: string) => {
      if (key === 'agents')
        return Promise.resolve({
          activeId: 'a1',
          list: [{ id: 'a1', name: 'Default Agent', promptFiles: [] }],
        })
      if (key === 'prompts') return Promise.resolve({ files: [] })
      return Promise.resolve(null)
    })
    mockGetMergedPrompt.mockResolvedValue('Merged prompt content')
  })

  it('renders title after loading', async () => {
    const { container } = render(<AgentsTab t={t} />)
    await vi.waitFor(() => expect(container.textContent).toContain('Agents'))
  })

  it('renders agent name in input value after loading', async () => {
    const { container } = render(<AgentsTab t={t} />)
    await vi.waitFor(
      () => {
        const inputs = container.querySelectorAll('input')
        const values = Array.from(inputs).map(
          (i) => (i as HTMLInputElement).value,
        )
        expect(values).toContain('Default Agent')
      },
      { timeout: 3000 },
    )
  })

  it('shows agent tools section', async () => {
    const { container } = render(<AgentsTab t={t} />)
    await vi.waitFor(() => expect(container.textContent).toContain('Tools'))
  })

  it('shows Restore Defaults when onRestore provided', async () => {
    const { container } = render(<AgentsTab onRestore={vi.fn()} t={t} />)
    await vi.waitFor(() =>
      expect(container.textContent).toContain('Restore Defaults'),
    )
  })
})
