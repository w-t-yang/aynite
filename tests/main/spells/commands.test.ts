import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockGetSpellConfig = vi.hoisted(() => vi.fn())
const mockSaveSpellConfig = vi.hoisted(() => vi.fn())
const mockListAvailableSpells = vi.hoisted(() => vi.fn())
const mockRestoreSpell = vi.hoisted(() => vi.fn())
const mockRestoreDefaultSpells = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  getCommandsDir: vi.fn(() => '/mock/.aynite/commands'),
  getCommandPath: vi.fn((name: string) => `/mock/.aynite/commands/${name}`),
}))

vi.mock('../../../src/main/spells/spell-installer', () => ({
  getSpellConfig: (...args: unknown[]) => mockGetSpellConfig(...args),
  saveSpellConfig: (...args: unknown[]) => mockSaveSpellConfig(...args),
  listAvailableSpells: (...args: unknown[]) => mockListAvailableSpells(...args),
  restoreSpell: (...args: unknown[]) => mockRestoreSpell(...args),
  restoreDefaultSpells: (...args: unknown[]) =>
    mockRestoreDefaultSpells(...args),
}))

import {
  getCommandsConfig,
  listAvailableCommands,
  restoreCommand,
  restoreDefaultCommands,
  saveCommandsConfig,
} from '../../../src/main/spells/commands'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSpellConfig.mockResolvedValue({ folders: ['/mock/.aynite/commands'] })
  mockSaveSpellConfig.mockResolvedValue(undefined)
  mockListAvailableSpells.mockResolvedValue([])
  mockRestoreSpell.mockResolvedValue(true)
  mockRestoreDefaultSpells.mockResolvedValue(true)
})

describe('commands', () => {
  it('getCommandsConfig delegates to getSpellConfig', async () => {
    const result = await getCommandsConfig()
    expect(result).toEqual({ folders: ['/mock/.aynite/commands'] })
  })

  it('saveCommandsConfig delegates to saveSpellConfig', async () => {
    await saveCommandsConfig({ folders: ['/custom'] })
    expect(mockSaveSpellConfig).toHaveBeenCalledWith('commands', {
      folders: ['/custom'],
    })
  })

  it('listAvailableCommands delegates with COMMAND.md and extras', async () => {
    await listAvailableCommands()
    expect(mockListAvailableSpells).toHaveBeenCalledWith(
      'commands',
      '/mock/.aynite/commands',
      'COMMAND.md',
      true,
    )
  })

  it('restoreDefaultCommands saves config and restores spells', async () => {
    const result = await restoreDefaultCommands()
    expect(result).toBe(true)
    expect(mockSaveSpellConfig).toHaveBeenCalledWith('commands', {
      folders: ['/mock/.aynite/commands'],
    })
    expect(mockRestoreDefaultSpells).toHaveBeenCalled()
  })

  it('restoreCommand calls restoreSpell with command path', async () => {
    const result = await restoreCommand('hello-command')
    expect(result).toBe(true)
    expect(mockRestoreSpell).toHaveBeenCalledWith(
      'commands',
      'hello-command',
      '/mock/.aynite/commands/hello-command',
    )
  })
})
