import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const workspacesDir = join(process.env.HOME || process.env.USERPROFILE || '', '.aynite', 'workspaces')

function migrateNode(node: any) {
  if (!node) return

  if (node.type === 'split' && Array.isArray(node.children)) {
    node.children.forEach(migrateNode)
  } else if (node.type === 'leaf') {
    if (node.url) {
      // aynite://<name>/index.html -> <name>
      const match = node.url.match(/aynite:\/\/([^/]+)\/index\.html/)
      if (match) {
        node.name = match[1]
      } else {
        node.name = node.url
      }
      delete node.url
    } else if (node.content && !node.name) {
      // Handle the vibes I created previously
      node.name = node.content
    }
    
    // Clean up content as it's no longer in LeafNode
    if ('content' in node) {
      delete node.content
    }
  }
}

function migrate() {
  try {
    const entries = readdirSync(workspacesDir)
    let migratedCount = 0

    for (const entry of entries) {
      const configPath = join(workspacesDir, entry, 'config.json')
      
      try {
        if (!statSync(configPath).isFile()) continue
      } catch {
        continue
      }

      const content = readFileSync(configPath, 'utf8')
      const config = JSON.parse(content)

      if (Array.isArray(config.layouts)) {
        config.layouts.forEach((layout: any) => {
          if (layout.layout) {
            migrateNode(layout.layout)
          }
        })
      }

      writeFileSync(configPath, JSON.stringify(config, null, 2))
      migratedCount++
      console.log(`Migrated workspace: ${entry}`)
    }

    console.log(`Successfully migrated ${migratedCount} workspaces.`)
  } catch (error) {
    console.error('Migration failed:', error)
  }
}

migrate()
