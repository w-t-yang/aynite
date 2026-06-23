import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockExistsSync = vi.hoisted(() => vi.fn())
const mockReaddirSync = vi.hoisted(() => vi.fn())
const mockReadJson = vi.hoisted(() => vi.fn())

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}))

vi.mock('../../../../src/lib/path/operations', () => ({
  readJson: (...args: unknown[]) => mockReadJson(...args),
}))

vi.mock('../../../../src/lib/path', () => ({
  getBotChatDir: (id: string, name: string) => `/mock/bots/${id}/${name}`,
  getBotChatDatePath: (id: string, name: string, date: string) =>
    `/mock/bots/${id}/${name}/${date}.json`,
}))

import { createGetMessagesTool } from '../../../../../src/main/ai/tools/get-messages'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createGetMessagesTool', () => {
  const tool = createGetMessagesTool('telegram-bot', '@username')

  it('returns no messages when chat directory does not exist', async () => {
    mockExistsSync.mockReturnValue(false)

    const result = await tool.execute({})

    expect(result).toBe('No messages found for this channel.')
    expect(mockExistsSync).toHaveBeenCalledWith(
      '/mock/bots/telegram-bot/@username',
    )
  })

  it('returns no messages when no date files found', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue([])

    const result = await tool.execute({})

    expect(result).toBe('No messages found for this channel.')
  })

  it('filters out non-json and session files', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue([
      '2026-06-20.json',
      'session',
      'metadata.json',
      '.DS_Store',
      '2026-06-21.json',
    ])
    mockReadJson.mockResolvedValue([])

    const result = await tool.execute({ count: 10 })

    // Should have filtered out session, metadata, .DS_Store
    expect(mockReaddirSync).toHaveBeenCalled()
    expect(result).toBe('No messages found.')
  })

  it('returns messages from the latest date file', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['2026-06-20.json', '2026-06-21.json'])
    mockReadJson.mockImplementation((path: string) => {
      if (path.includes('2026-06-21')) {
        return Promise.resolve([
          {
            role: 'user',
            sender: '@alice',
            text: 'hi',
            timestamp: '2026-06-21T10:00:00Z',
          },
          {
            role: 'assistant',
            sender: 'Bot',
            text: 'hello',
            timestamp: '2026-06-21T10:00:05Z',
          },
        ])
      }
      return Promise.resolve([])
    })

    const result = await tool.execute({ count: 10 })

    expect(result).toContain('@alice: hi')
    expect(result).toContain('Bot: hello')
    expect(result).toContain('Showing 2 messages')
  })

  it('scans backwards across multiple date files to reach count', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue([
      '2026-06-19.json',
      '2026-06-20.json',
      '2026-06-21.json',
    ])
    let callCount = 0
    mockReadJson.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // June 21 — only 1 message
        return Promise.resolve([
          {
            role: 'user',
            sender: '@bob',
            text: 'today',
            timestamp: '2026-06-21T10:00:00Z',
          },
        ])
      }
      // June 20 — has more messages
      return Promise.resolve([
        {
          role: 'user',
          sender: '@bob',
          text: 'yesterday',
          timestamp: '2026-06-20T15:00:00Z',
        },
        {
          role: 'assistant',
          sender: 'Bot',
          text: 'reply',
          timestamp: '2026-06-20T15:00:05Z',
        },
      ])
    })

    const result = await tool.execute({ count: 3 })

    // Should have all 3 messages from both dates
    expect(result).toContain('today')
    expect(result).toContain('yesterday')
    expect(result).toContain('reply')
  })

  it('uses since parameter to start from a specific date', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue([
      '2026-06-19.json',
      '2026-06-20.json',
      '2026-06-21.json',
    ])
    mockReadJson.mockResolvedValue([
      {
        role: 'user',
        sender: '@carol',
        text: 'msg',
        timestamp: '2026-06-20T12:00:00Z',
      },
    ])

    await tool.execute({ count: 5, since: '2026-06-20' })

    // Should have called readJson for June 20 and June 19
    const calls = mockReadJson.mock.calls
    const calledDates = calls.map((c: any) => c[0])
    expect(calledDates.some((p: string) => p.includes('2026-06-20'))).toBe(true)
    expect(calledDates.some((p: string) => p.includes('2026-06-19'))).toBe(true)
  })

  it('caps count at 50', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['2026-06-21.json'])
    const msgs = Array.from({ length: 60 }, (_, i) => ({
      role: 'user' as const,
      sender: `user${i}`,
      text: `msg${i}`,
      timestamp: `2026-06-21T${String(i).padStart(2, '0')}:00:00Z`,
    }))
    mockReadJson.mockResolvedValue(msgs)

    const result = await tool.execute({ count: 100 })

    expect(result).toContain('Showing 50')
    expect(result).toContain('available messages')
    expect(result).toContain('requested 50')
  })

  it('handles read errors gracefully', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['2026-06-21.json'])
    mockReadJson.mockRejectedValue(new Error('disk read failed'))

    const result = await tool.execute({ count: 10 })

    expect(result).toContain('Error reading messages')
    expect(result).toContain('disk read failed')
  })

  it('returns the most recent messages when count is small', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['2026-06-21.json'])
    const msgs = Array.from({ length: 5 }, (_, i) => ({
      role: 'user' as const,
      sender: `u${i}`,
      text: `msg${i}`,
      timestamp: `2026-06-21T${String(i).padStart(2, '0')}:00:00Z`,
    }))
    mockReadJson.mockResolvedValue(msgs)

    const result = await tool.execute({ count: 3 })

    expect(result).toContain('Showing 3 of 5 available messages')
  })
})
