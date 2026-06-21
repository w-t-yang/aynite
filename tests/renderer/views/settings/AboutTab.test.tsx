// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { AboutTab } from '../../../../src/renderer/views/settings/AboutTab'

const mockConfigGet = vi.hoisted(() => vi.fn())
vi.mock('../../../../src/renderer/bridge/config', () => ({
  config: { get: (...args: unknown[]) => mockConfigGet(...args) },
  configMutations: { set: vi.fn(() => Promise.resolve()) },
}))
vi.mock('../../../../src/renderer/bridge/update', () => ({
  updateMutations: { check: vi.fn(), download: vi.fn(), install: vi.fn() },
}))
vi.mock('../../../../src/renderer/views/useViewEvents', () => ({
  useViewEvent: vi.fn(),
}))

const t = (key: string): string =>
  ({
    'about.title': 'About',
    'about.description': 'App info',
    'about.version': 'VERSION',
    'about.update.title': 'Update',
    'about.update.description': 'Check for updates',
    'about.update.checkButton': 'Check Update',
    'about.update.status': 'Status',
    'about.update.statusIdle': 'Up to date',
    'about.update.current': 'Current:',
    'about.update.close': 'Close',
    'about.resources.title': 'Resources',
    'about.resources.description': 'Links',
    'about.resources.github': 'GitHub',
    'about.resources.githubDesc': 'Source code',
    'about.resources.reportIssue': 'Report Issue',
    'about.footer': 'Made with ❤',
  })[key] || key

describe('AboutTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfigGet.mockImplementation((key: string) => {
      if (key === 'version') return Promise.resolve('1.0.0')
      return Promise.resolve(null)
    })
  })

  it('renders description text', async () => {
    const { container } = render(<AboutTab onOpenExternal={vi.fn()} t={t} />)
    await vi.waitFor(() => expect(container.textContent).toContain('App info'))
  })

  it('renders Check Update button', async () => {
    const { container } = render(<AboutTab onOpenExternal={vi.fn()} t={t} />)
    await vi.waitFor(() =>
      expect(container.textContent).toContain('Check Update'),
    )
  })

  it('loads version config on mount', async () => {
    render(<AboutTab onOpenExternal={vi.fn()} t={t} />)
    await vi.waitFor(() => {
      expect(mockConfigGet).toHaveBeenCalledWith('version')
    })
  })

  it('renders the app version', async () => {
    const { container } = render(<AboutTab onOpenExternal={vi.fn()} t={t} />)
    await vi.waitFor(() => expect(container.textContent).toContain('v1.0.0'))
  })

  it('renders GitHub and Report Issue buttons', async () => {
    const { container } = render(<AboutTab onOpenExternal={vi.fn()} t={t} />)
    await vi.waitFor(() => {
      expect(container.textContent).toContain('GitHub')
      expect(container.textContent).toContain('Report Issue')
    })
  })
})
