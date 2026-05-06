import { getCommandPath, getCommandsDir } from '../../lib/path'
import {
  getSpellConfig,
  listAvailableSpells,
  restoreSpell as restoreBundledSpell,
  restoreDefaultSpells,
  saveSpellConfig,
} from './spell-installer'

export async function getCommandsConfig() {
  return getSpellConfig('commands', getCommandsDir())
}

export async function saveCommandsConfig(config: any) {
  return saveSpellConfig('commands', config)
}

export async function listAvailableCommands() {
  return listAvailableSpells('commands', getCommandsDir(), 'COMMAND.md', true)
}

export async function restoreDefaultCommands() {
  return restoreDefaultSpells('commands', ['hello-command'], (name) =>
    getCommandPath(name),
  )
}

export async function restoreCommand(commandName: string) {
  return restoreBundledSpell(
    'commands',
    commandName,
    getCommandPath(commandName),
  )
}
