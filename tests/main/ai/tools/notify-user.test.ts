import { describe, expect, it, vi } from 'vitest'
import { createNotifyUserTool } from '../../../../src/main/ai/tools/notify-user'

describe('createNotifyUserTool', () => {
  it('sends message via ctx.reply and returns confirmation', async () => {
    const reply = vi.fn()
    const tool = createNotifyUserTool({ reply, replyWithMarkdown: vi.fn() })

    const result = await tool.execute({ message: 'Working on it...' })

    expect(reply).toHaveBeenCalledWith('Working on it...')
    expect(result).toContain('Notification sent')
    expect(result).toContain('Working on it...')
  })

  it('handles empty message', async () => {
    const reply = vi.fn()
    const tool = createNotifyUserTool({ reply, replyWithMarkdown: vi.fn() })

    const result = await tool.execute({ message: '' })

    expect(reply).toHaveBeenCalledWith('')
    expect(result).toContain('Notification sent')
  })

  it('has correct input schema', () => {
    const tool = createNotifyUserTool({
      reply: vi.fn(),
      replyWithMarkdown: vi.fn(),
    })

    expect(tool.description).toContain('Send a message to the user')
    expect(tool.inputSchema).toBeDefined()
    expect(tool.execute).toBeDefined()
  })
})
