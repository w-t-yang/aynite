import type { Input } from 'electron'
import { AppEvents } from '../../lib/constants/app'
import { loadConfig } from '../config'
import { onBeforeInputEvent, sendAppEvent, sendAppOperation } from '../window'

interface KeyBinding {
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  key: string
}

interface MatchedOperation {
  name: string
  type: 'app' | 'view'
}

let keymap = new Map<string, MatchedOperation>()

/**
 * Standardizes keyboard input into a string key for O(1) lookup.
 */
function serializeKey(binding: KeyBinding | Input): string {
  const parts: string[] = []

  // Use property names consistent across KeyBinding and Electron.Input
  const isInput = 'control' in binding
  const ctrl = isInput
    ? (binding as Input).control || (binding as Input).meta
    : (binding as KeyBinding).ctrl
  const shift = isInput
    ? (binding as Input).shift
    : (binding as KeyBinding).shift
  const alt = isInput ? (binding as Input).alt : (binding as KeyBinding).alt
  const key = isInput
    ? (binding as Input).key.toLowerCase()
    : (binding as KeyBinding).key.toLowerCase()

  if (ctrl) parts.push('ctrl')
  if (shift) parts.push('shift')
  if (alt) parts.push('alt')
  parts.push(key)

  return parts.join('+')
}

function handleKeyboardInput(input: Input): MatchedOperation | null {
  if (input.type !== 'keyDown') return null

  const serialized = serializeKey(input)
  return keymap.get(serialized) || null
}

export async function refreshKeybindings() {
  try {
    const config = await loadConfig()
    const newKeymap = new Map<string, MatchedOperation>()

    // Load App keybindings (Higher priority)
    if (config.keybindings?.app) {
      for (const [operation, binding] of Object.entries(
        config.keybindings.app,
      )) {
        const key = serializeKey(binding as KeyBinding)
        newKeymap.set(key, { name: operation, type: 'app' })
      }
    }

    // Load View keybindings
    if (config.keybindings?.view) {
      for (const [operation, binding] of Object.entries(
        config.keybindings.view,
      )) {
        const key = serializeKey(binding as KeyBinding)
        // Only set if not already defined by an app binding
        if (!newKeymap.has(key)) {
          newKeymap.set(key, { name: operation, type: 'view' })
        }
      }
    }

    keymap = newKeymap
  } catch (e) {
    console.error('[Keybindings] Failed to load keybindings:', e)
  }
}

/**
 * Initializes keybindings: loads config and attaches the global listener.
 */
export function setupKeybindings() {
  // 1. Initial load of keymap
  refreshKeybindings()

  // 2. Attach global listener via window module
  onBeforeInputEvent((event, input) => {
    const matched = handleKeyboardInput(input)
    if (!matched) return

    if (matched.type === 'app') {
      sendAppOperation(matched.name)
    } else {
      sendAppEvent(AppEvents.APP_OPERATION, matched.name)
    }

    event.preventDefault()
  })
}
