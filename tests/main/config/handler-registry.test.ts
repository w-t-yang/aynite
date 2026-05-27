import { describe, expect, it, vi } from 'vitest'
import {
  ConfigHandlerRegistry,
  HANDLER_NOT_FOUND,
} from '../../../src/main/config/handler-registry'

describe('ConfigHandlerRegistry', () => {
  it('returns HANDLER_NOT_FOUND for unregistered key', async () => {
    const registry = new ConfigHandlerRegistry()
    const result = await registry.dispatchGet('unknown-key')
    expect(result).toBe(HANDLER_NOT_FOUND)
  })

  it('returns false for unregistered set key', async () => {
    const registry = new ConfigHandlerRegistry()
    const result = await registry.dispatchSet('unknown-key', {})
    expect(result).toBe(false)
  })

  it('dispatches get to registered handler', async () => {
    const registry = new ConfigHandlerRegistry()
    const handler = {
      get: vi.fn(async () => 'handler-result'),
    }
    registry.register(['test-key'], handler)
    const result = await registry.dispatchGet('test-key', { foo: 'bar' }, 1)
    expect(result).toBe('handler-result')
    expect(handler.get).toHaveBeenCalledWith('test-key', { foo: 'bar' }, 1)
  })

  it('dispatches set to registered handler', async () => {
    const registry = new ConfigHandlerRegistry()
    const handler = {
      set: vi.fn(async () => true),
    }
    registry.register(['test-key'], handler)
    const result = await registry.dispatchSet('test-key', { value: 42 }, 1)
    expect(result).toBe(true)
    expect(handler.set).toHaveBeenCalledWith('test-key', { value: 42 }, 1)
  })

  it('registers multiple keys to same handler', async () => {
    const registry = new ConfigHandlerRegistry()
    const handler = {
      get: vi.fn(async () => 'shared'),
    }
    registry.register(['key-a', 'key-b'], handler)

    const resultA = await registry.dispatchGet('key-a')
    const resultB = await registry.dispatchGet('key-b')
    expect(resultA).toBe('shared')
    expect(resultB).toBe('shared')
  })

  it('returns HANDLER_NOT_FOUND when handler has no get method', async () => {
    const registry = new ConfigHandlerRegistry()
    registry.register(['set-only'], { set: vi.fn(async () => true) })
    const result = await registry.dispatchGet('set-only')
    expect(result).toBe(HANDLER_NOT_FOUND)
  })

  it('returns false when handler has no set method', async () => {
    const registry = new ConfigHandlerRegistry()
    registry.register(['get-only'], { get: vi.fn(async () => 'data') })
    const result = await registry.dispatchSet('get-only', {})
    expect(result).toBe(false)
  })
})
