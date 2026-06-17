// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { AppearanceTab } from '../../../../src/renderer/views/settings/AppearanceTab'

const mockConfigGet = vi.hoisted(() => vi.fn())
const mockGetSystemFonts = vi.hoisted(() => vi.fn())

vi.mock('../../../../src/renderer/bridge/config', () => ({
  config: { get: (...args: unknown[]) => mockConfigGet(...args) },
  configMutations: { set: vi.fn(() => Promise.resolve()) },
}))
vi.mock('../../../../src/renderer/bridge/system', () => ({
  system: {
    getSystemFonts: (...args: unknown[]) => mockGetSystemFonts(...args),
  },
}))
vi.mock('../../../../src/renderer/bridge/theme', () => ({
  themeMutations: { delete: vi.fn(() => Promise.resolve()) },
}))
vi.mock('../../../../src/renderer/views/ViewContext', () => ({
  useView: () => ({ setTheme: vi.fn() }),
}))

const t = (key: string): string =>
  ({
    'appearance.title': 'Appearance',
    'appearance.description': 'Customize look & feel',
    'appearance.presets.title': 'Themes',
    'appearance.presets.description': 'Choose a theme',
    'appearance.duplicateTheme': 'Duplicate',
  })[key] || key

const mockTheme = {
  id: 'nord',
  name: 'Nord',
  type: 'dark',
  isSystem: true,
  colors: {
    background: '#fff',
    foreground: '#000',
    primary: '#3b82f6',
    'primary-foreground': '#fff',
  },
}

describe('AppearanceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfigGet.mockImplementation((key: string) => {
      if (key === 'themes') return Promise.resolve([mockTheme])
      if (key === 'activeTheme') return Promise.resolve('nord')
      return Promise.resolve(null)
    })
    mockGetSystemFonts.mockResolvedValue(['Inter', 'Arial'])
  })

  it('renders title after loading', async () => {
    const { container } = render(<AppearanceTab t={t} />)
    await vi.waitFor(() =>
      expect(container.textContent).toContain('Appearance'),
    )
  })

  it('renders theme name after loading', async () => {
    const { container } = render(<AppearanceTab t={t} />)
    await vi.waitFor(() => expect(container.textContent).toContain('Nord'))
  })

  it('shows Restore Defaults when onRestore provided', async () => {
    const { container } = render(<AppearanceTab onRestore={vi.fn()} t={t} />)
    await vi.waitFor(() =>
      expect(container.textContent).toContain('Restore Defaults'),
    )
  })
})
