import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const SESSIONS_DIR = path.join(os.homedir(), '.aynite', 'sessions')

async function migrate() {
  console.log(`Starting migration in ${SESSIONS_DIR}...`)

  try {
    const dates = await fs.readdir(SESSIONS_DIR, { withFileTypes: true })
    
    for (const dateDir of dates) {
      if (!dateDir.isDirectory()) continue
      
      const datePath = path.join(SESSIONS_DIR, dateDir.name)
      const files = await fs.readdir(datePath)
      
      for (const file of files) {
        if (!file.endsWith('.json') || file.endsWith('-metadata.json')) continue
        
        const filePath = path.join(datePath, file)
        console.log(`Migrating ${filePath}...`)
        
        try {
          const content = await fs.readFile(filePath, 'utf8')
          const messages = JSON.parse(content)
          
          if (!Array.isArray(messages)) {
            console.warn(`Skipping ${file}: not an array`)
            continue
          }
          
          const migrated = transform(messages)
          await fs.writeFile(filePath, JSON.stringify(migrated, null, 2))
          console.log(`Successfully migrated ${file}`)
        } catch (err) {
          console.error(`Failed to migrate ${file}:`, err)
        }
      }
    }
    
    console.log('Migration complete!')
  } catch (err) {
    console.error('Migration failed:', err)
  }
}

function transform(messages: any[]): any[] {
  const result: any[] = []
  const knownCalls = new Set<string>()

  // 1. Pass to find known calls
  for (const msg of messages) {
    const parts = (msg.parts || (Array.isArray(msg.content) ? msg.content : [])) as any[]
    for (const p of parts) {
      if (p.type === 'tool-call' || (p.type === 'dynamic-tool' && (p.state === 'input-available' || p.state === 'input-streaming'))) {
        if (p.toolCallId) knownCalls.add(p.toolCallId)
      }
    }
  }

  // 2. Pass to transform and recover
  for (const msg of messages) {
    const currentParts = [
      ...(msg.parts || (Array.isArray(msg.content) ? msg.content : [])),
    ]
    const assistantParts: any[] = []
    const toolParts: any[] = []
    const otherParts: any[] = []

    for (const p of currentParts) {
      if (p.type === 'dynamic-tool') {
        const isResult = p.state === 'output-available' || p.state === 'output-error'
        if (isResult) {
          toolParts.push({
            type: 'tool-result',
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            result: p.output ?? p.result,
            output: p.output ?? p.result,
            isError: p.state === 'output-error',
          })
        } else {
          assistantParts.push({
            type: 'tool-call',
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            args: p.input ?? p.args,
            input: p.input ?? p.args,
          })
          if (p.toolCallId) knownCalls.add(p.toolCallId)
        }
      } else if (p.type === 'tool-call') {
        assistantParts.push({
          ...p,
          args: p.input ?? p.args,
          input: p.input ?? p.args,
        })
        if (p.toolCallId) knownCalls.add(p.toolCallId)
      } else if (p.type === 'tool-result') {
        toolParts.push({
          ...p,
          result: p.output ?? p.result,
          output: p.output ?? p.result,
        })
      } else if (p.type === 'reasoning') {
        assistantParts.push({ type: 'text', text: `Thinking:\n${p.text}` })
      } else if (p.type === 'text') {
        if (msg.role === 'assistant') assistantParts.push(p)
        else otherParts.push(p)
      } else {
        otherParts.push(p)
      }
    }

    if (msg.role === 'user' || msg.role === 'system') {
      result.push({
        role: msg.role,
        content: otherParts.length > 0 ? otherParts : (msg.content || ''),
      })
    } else if (msg.role === 'assistant') {
      if (assistantParts.length > 0) {
        result.push({ role: 'assistant', content: assistantParts })
      }
      if (toolParts.length > 0) {
        result.push({ role: 'tool', content: toolParts })
      }
    } else if (msg.role === 'tool') {
      // RECOVERY: If we have tool results but no corresponding call was found,
      // insert an assistant message with the call first.
      for (const p of toolParts) {
        if (p.toolCallId && !knownCalls.has(p.toolCallId)) {
          result.push({
            role: 'assistant',
            content: [{
              type: 'tool-call',
              toolCallId: p.toolCallId,
              toolName: p.toolName,
              args: p.input || p.args || {},
              input: p.input || p.args || {},
            }]
          })
          knownCalls.add(p.toolCallId)
        }
      }
      result.push({
        role: 'tool',
        content: toolParts.length > 0 ? toolParts : otherParts,
      })
    }
  }

  return result
}

migrate()
