import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Hoisted mocks ───────────────────────────────────────────────────────

const mockReadJson = vi.hoisted(() => vi.fn())
const mockExists = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())
const mockReaddirSync = vi.hoisted(() => vi.fn())
const mockGetAyniteDir = vi.hoisted(() => vi.fn(() => '/mock/.aynite'))

vi.mock('../../../src/lib/path', () => ({
  readJson: (...args: unknown[]) => mockReadJson(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  exists: (...args: unknown[]) => mockExists(...args),
  getAyniteDir: mockGetAyniteDir,
  getMainConfigPath: vi.fn(() => '/mock/.aynite/config/config.json'),
  getAIConfigPath: vi.fn(() => '/mock/.aynite/config/ai.json'),
  getAgentPath: vi.fn((id: string) => `/mock/.aynite/agents/${id}.json`),
  getAgentsDir: vi.fn(() => '/mock/.aynite/agents'),
  getBotSessionDir: vi.fn(
    (id: string, chat: string) => `/mock/.aynite/bots/${id}/${chat}/session`,
  ),
  getBotSessionMessagesPath: vi.fn(
    (id: string, chat: string) =>
      `/mock/.aynite/bots/${id}/${chat}/session/messages.json`,
  ),
  getBotSessionMetadataPath: vi.fn(
    (id: string, chat: string) =>
      `/mock/.aynite/bots/${id}/${chat}/session/metadata.json`,
  ),
  getBotChatDatePath: vi.fn(
    (id: string, chat: string, date: string) =>
      `/mock/.aynite/bots/${id}/${chat}/${date}.json`,
  ),
  getBotCommitPath: vi.fn(
    (id: string, chat: string, commitId: string) =>
      `/mock/.aynite/bots/${id}/${chat}/commits/${commitId}.json`,
  ),
  getBotCommitsDir: vi.fn(
    (id: string, chat: string) => `/mock/.aynite/bots/${id}/${chat}/commits`,
  ),
  getBotSessionArchivePath: vi.fn(
    (id: string, chat: string, ts: number | string, suffix?: string) =>
      suffix
        ? `/mock/.aynite/bots/${id}/${chat}/session/archive/${ts}-${suffix}.json`
        : `/mock/.aynite/bots/${id}/${chat}/session/archive/${ts}.json`,
  ),
  getWorkspacesConfigPath: vi.fn(() => '/mock/.aynite/config/workspaces.json'),
  getWorkspaceDataPath: vi.fn(
    () => '/mock/.aynite/workspaces/Aynite/config.json',
  ),
  getMessengersConfigPath: vi.fn(() => '/mock/.aynite/config/messengers.json'),
  joinPaths: vi.fn((...parts: string[]) => parts.join('/')),
  rename: vi.fn(),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  AYNITE_SUBDIRS: {
    CONFIG: 'config',
    LOGS: 'logs',
    PROMPTS: 'prompts',
    THEMES: 'themes',
    SKILLS: 'skills',
    COMMANDS: 'commands',
    VIEWS: 'views',
    WORKSPACES: 'workspaces',
    SESSIONS: 'sessions',
    AGENTS: 'agents',
  },
}))

vi.mock('../../../src/main/ai', () => ({
  getProviderReasoningOptions: vi.fn(() => ({})),
  getMergedSystemPrompt: vi.fn(() => 'You are a helpful assistant.'),
  getDefaultGlobalPrompts: vi.fn(() => []),
}))

vi.mock('../../../src/main/ai/agent-engine', () => ({
  runAgentSession: vi.fn(() => ({
    messages: [],
    text: 'Mock response from AI',
    reasoning: '',
    toolCalls: [],
  })),
}))

vi.mock('../../../src/main/ai/tools/get-messages', () => ({
  createGetMessagesTool: vi.fn(() => ({}) as any),
}))

vi.mock('../../../src/main/ai/tools/notify-user', () => ({
  createNotifyUserTool: vi.fn(() => ({}) as any),
}))

vi.mock('node:fs', () => ({
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}))

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  rename: vi.fn(),
}))

vi.mock('../../../src/main/spells/skills', () => ({
  listAvailableSkills: vi.fn(() => []),
  getSkillsConfig: vi.fn(() => ({ folders: [] })),
}))

// ── Imports ──────────────────────────────────────────────────────────────

import type { MessengerConfig } from '../../../src/lib/types/ai'
import type {
  IncomingMessage,
  MessengerContext,
} from '../../../src/main/messengers/shared'
import { processIncomingMessage } from '../../../src/main/messengers/shared'

// ── Tests ────────────────────────────────────────────────────────────────

describe('processIncomingMessage', () => {
  const config: MessengerConfig = {
    id: 'test-bot',
    provider: 'telegram',
    apiKey: 'test-key',
    whitelist: ['12345', '@testuser'],
    agentId: 'test-agent',
    projectFolder: '/test/project',
    enabled: true,
    connected: true,
  }

  const ctx: MessengerContext = {
    reply: vi.fn(),
    replyWithMarkdown: vi.fn(),
  }

  function msg(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
    return {
      rawText: '',
      isPrivate: true,
      chatName: '@testuser',
      chatId: '12345',
      senderLabel: '@testuser',
      textWithoutMention: '',
      isMentioned: true,
      senderRaw: '12345',
      senderUsername: 'testuser',
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock for readJson: return agent data for loadAgent,
    // then workspaces config for getActiveWorkspace
    mockReadJson.mockImplementation(async (path: string) => {
      if (path?.includes('/agents/test-agent.json')) {
        return { name: 'TestAgent', introduction: 'A test agent' }
      }
      if (path?.includes('workspaces')) {
        return { active: 'Aynite', list: ['Aynite'] }
      }
      if (path?.includes('ai.json')) {
        return { activeId: 'test', providers: [{ id: 'test', name: 'Test' }] }
      }
      if (path?.includes('config.json')) {
        return { version: '1.0.0' }
      }
      if (path?.includes('messengers')) {
        return []
      }
      if (path?.includes('messages.json')) {
        return []
      }
      return {}
    })
  })

  describe('/? command routing', () => {
    it('routes /? to handleHelp and does NOT start agent loop', async () => {
      await processIncomingMessage(
        config,
        ctx,
        msg({
          rawText: '/?',
          textWithoutMention: '/?',
        }),
      )

      // Should reply with help text (markdown)
      expect(ctx.replyWithMarkdown).toHaveBeenCalledOnce()
      const helpText = (ctx.replyWithMarkdown as any).mock.calls[0][0]
      expect(helpText).toContain('Aynite Bot')
      expect(helpText).toContain('Commands:')

      // Should NOT trigger the agent
      const { runAgentSession } = await import(
        '../../../src/main/ai/agent-engine'
      )
      expect(runAgentSession).not.toHaveBeenCalled()
    })

    it('routes /? in group mention to handleHelp', async () => {
      await processIncomingMessage(
        config,
        ctx,
        msg({
          rawText: '@bot /?',
          textWithoutMention: '/?',
          isPrivate: false,
          isMentioned: true,
        }),
      )

      expect(ctx.replyWithMarkdown).toHaveBeenCalledOnce()
      const { runAgentSession } = await import(
        '../../../src/main/ai/agent-engine'
      )
      expect(runAgentSession).not.toHaveBeenCalled()
    })

    it('routes /help to handleHelp', async () => {
      await processIncomingMessage(
        config,
        ctx,
        msg({
          rawText: '/help',
          textWithoutMention: '/help',
        }),
      )

      expect(ctx.replyWithMarkdown).toHaveBeenCalledOnce()
      const { runAgentSession } = await import(
        '../../../src/main/ai/agent-engine'
      )
      expect(runAgentSession).not.toHaveBeenCalled()
    })
  })

  describe('non-command messages', () => {
    it('routes regular text to the agent loop', async () => {
      await processIncomingMessage(
        config,
        ctx,
        msg({
          rawText: 'Hello',
          textWithoutMention: 'Hello',
        }),
      )

      const { runAgentSession } = await import(
        '../../../src/main/ai/agent-engine'
      )
      expect(runAgentSession).toHaveBeenCalledOnce()
    })
  })

  describe('whitelist enforcement', () => {
    it('blocks unwhitelisted users even for /?', async () => {
      await processIncomingMessage(
        config,
        ctx,
        msg({
          rawText: '/?',
          textWithoutMention: '/?',
          senderRaw: '99999',
          senderUsername: 'stranger',
        }),
      )

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('not allowed'),
      )
      expect(ctx.replyWithMarkdown).not.toHaveBeenCalled()
      const { runAgentSession } = await import(
        '../../../src/main/ai/agent-engine'
      )
      expect(runAgentSession).not.toHaveBeenCalled()
    })
  })

  describe('group message filtering', () => {
    it('ignores non-mentioned group messages entirely', async () => {
      await processIncomingMessage(
        config,
        ctx,
        msg({
          rawText: '/?',
          textWithoutMention: '/?',
          isPrivate: false,
          isMentioned: false,
        }),
      )

      expect(ctx.replyWithMarkdown).not.toHaveBeenCalled()
      expect(ctx.reply).not.toHaveBeenCalled()
      const { runAgentSession } = await import(
        '../../../src/main/ai/agent-engine'
      )
      expect(runAgentSession).not.toHaveBeenCalled()
    })
  })
})
