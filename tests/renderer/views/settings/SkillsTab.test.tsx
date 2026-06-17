// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { SettingsFolderTab } from '../../../../src/renderer/views/settings/SettingsFolderTab'

const t = (key: string): string =>
  ({
    'skills.title': 'Skills',
    'skills.pageDescription': 'Manage skill folders',
    'skills.folderSectionTitle': 'Folders',
    'skills.folderSectionDescription': 'Configure skill folders',
    'skills.addFolderLabel': 'Add Folder',
    'skills.noFoldersLabel': 'No folders configured',
    'skills.detectedSectionTitle': 'Detected Skills',
    'skills.detectedSectionDescription': 'Available skills',
    'skills.noDescription': 'No description',
    'skills.noItemsLabel': 'No skills found',
    'skills.removeModalTitle': 'Remove Folder',
    'skills.removeModalBody': 'Remove folder',
  })[key] || key

describe('SettingsFolderTab (Skills)', () => {
  it('renders title and description', () => {
    render(
      <SettingsFolderTab
        prefix="skills"
        folders={{ folders: [] }}
        setFolders={vi.fn()}
        items={[]}
        onAddFolder={vi.fn()}
        t={t}
      />,
    )
    expect(screen.getByText('Skills')).toBeInTheDocument()
  })

  it('shows empty folder state', () => {
    const { container } = render(
      <SettingsFolderTab
        prefix="skills"
        folders={{ folders: [] }}
        setFolders={vi.fn()}
        items={[]}
        onAddFolder={vi.fn()}
        t={t}
      />,
    )
    expect(container.textContent).toContain('No folders configured')
  })

  it('shows empty items state', () => {
    const { container } = render(
      <SettingsFolderTab
        prefix="skills"
        folders={{ folders: [] }}
        setFolders={vi.fn()}
        items={[]}
        onAddFolder={vi.fn()}
        t={t}
      />,
    )
    expect(container.textContent).toContain('No skills found')
  })

  it('renders folder names', () => {
    const { container } = render(
      <SettingsFolderTab
        prefix="skills"
        folders={{ folders: ['/path/to/skills'] }}
        setFolders={vi.fn()}
        items={[]}
        onAddFolder={vi.fn()}
        t={t}
      />,
    )
    expect(container.textContent).toContain('skills')
  })

  it('renders detected skill names', () => {
    const { container } = render(
      <SettingsFolderTab
        prefix="skills"
        folders={{ folders: [] }}
        setFolders={vi.fn()}
        items={[
          {
            name: 'My Skill',
            description: 'A cool skill',
            path: '/path/to/skill',
            error: null,
          },
        ]}
        onAddFolder={vi.fn()}
        t={t}
      />,
    )
    expect(container.textContent).toContain('My Skill')
    expect(container.textContent).toContain('A cool skill')
  })

  it('renders skill with error state', () => {
    const { container } = render(
      <SettingsFolderTab
        prefix="skills"
        folders={{ folders: [] }}
        setFolders={vi.fn()}
        items={[
          {
            name: 'Broken Skill',
            description: '',
            path: '/path',
            error: 'YAML parse error',
          },
        ]}
        onAddFolder={vi.fn()}
        t={t}
      />,
    )
    expect(container.textContent).toContain('Broken Skill')
    expect(container.textContent).toContain('YAML parse error')
  })

  it('renders Add Folder button', () => {
    const { container } = render(
      <SettingsFolderTab
        prefix="skills"
        folders={{ folders: [] }}
        setFolders={vi.fn()}
        items={[]}
        onAddFolder={vi.fn()}
        t={t}
      />,
    )
    expect(container.textContent).toContain('Add Folder')
  })

  it('renders Restore Defaults when provided', () => {
    const { container } = render(
      <SettingsFolderTab
        prefix="skills"
        folders={{ folders: [] }}
        setFolders={vi.fn()}
        items={[]}
        onAddFolder={vi.fn()}
        onRestore={vi.fn()}
        t={t}
      />,
    )
    expect(container.textContent).toContain('Restore Defaults')
  })
})
