import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { jsonSchema } from '@ai-sdk/provider-utils'
import { generateText } from 'ai'

async function testProviders() {
  const configPath = path.join(os.homedir(), '.aynite', 'config', 'ai.json')

  if (!fs.existsSync(configPath)) {
    console.error('Config file not found at:', configPath)
    return
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  const providers = config.configs

  console.log('--- AI Provider Test Suite ---\n')

  for (const [name, pConfig] of Object.entries(providers) as [string, any][]) {
    console.log(`Testing [${name.toUpperCase()}]...`)

    if (
      name !== 'ollama' &&
      (!pConfig.apiKey || pConfig.apiKey.trim() === '')
    ) {
      console.log(`  - Skip: No API Key provided.\n`)
      continue
    }

    try {
      let model
      if (name === 'openai') {
        model = createOpenAI({
          apiKey: pConfig.apiKey,
          baseURL: pConfig.url,
        }).chat(pConfig.model)
      } else if (name === 'anthropic') {
        model = createAnthropic({
          apiKey: pConfig.apiKey,
          baseURL: pConfig.url,
        })(pConfig.model)
      } else if (name === 'gemini' || name === 'google') {
        model = createGoogleGenerativeAI({ apiKey: pConfig.apiKey })(
          pConfig.model,
        )
      } else if (name === 'deepseek') {
        model = createDeepSeek({
          apiKey: pConfig.apiKey,
          baseURL: pConfig.url,
        })(pConfig.model)
      } else if (name === 'ollama' || name === 'others') {
        let baseUrl = pConfig.url
        if (name === 'ollama' && baseUrl && !baseUrl.endsWith('/v1')) {
          baseUrl = `${baseUrl.replace(/\/$/, '')}/v1`
        }
        model = createOpenAI({
          apiKey: pConfig.apiKey || 'no-key',
          baseURL: baseUrl,
        }).chat(pConfig.model)
      }

      if (!model) {
        console.log(`  - Error: Could not initialize model for ${name}\n`)
        continue
      }

      const pingTool = {
        description: 'A tool that pings.',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        }),
        execute: async ({ message }: { message: string }) => `Pong: ${message}`,
      }

      const { text, toolCalls } = await generateText({
        model: model as any,
        prompt: 'Call the ping tool with message "hello".',
        tools: {
          ping: pingTool,
        },
        toolChoice:
          name === 'deepseek' && pConfig.model.includes('reasoner')
            ? 'auto'
            : 'required',
      })

      if (toolCalls && toolCalls.length > 0) {
        console.log(
          `  - Result: SUCCESS! Tool Call: "${toolCalls[0].toolName}" with args: ${JSON.stringify((toolCalls[0] as any).args)}\n`,
        )
      } else {
        console.log(`  - Result: SUCCESS! Response: "${text.trim()}"\n`)
      }
    } catch (error: any) {
      console.log(`  - Result: FAILED. Error: ${error.message}\n`)
    }
  }
}

testProviders().catch(console.error)
