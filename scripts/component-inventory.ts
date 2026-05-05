import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

interface ComponentEntry {
  name: string
  path: string
  type: 'component' | 'hook' | 'utility' | 'type'
  exports: string[]
  propsInterface: string | null
  layer: 'basic' | 'featured' | 'lib' | 'view'
}

const LAYERS = ['basic', 'featured', 'lib'] as const
const SHARED_DIR = join(process.cwd(), 'src', 'renderer', 'shared')

function scanExports(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const exports: string[] = []
    for (const line of content.split('\n')) {
      const exportMatch = line.match(/^export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/)
      if (exportMatch) exports.push(exportMatch[1])
      const interfaceMatch = line.match(/^export\s+(?:interface|type)\s+(\w+)/)
      if (interfaceMatch) exports.push(interfaceMatch[1])
    }
    return exports
  } catch {
    return []
  }
}

function findPropsInterface(filePath: string, componentName: string): string | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const propsPattern = new RegExp(`(?:interface|type)\\s+${componentName}Props\\b`, 'i')
    return propsPattern.test(content) ? `${componentName}Props` : null
  } catch {
    return null
  }
}

function categorizeExport(name: string): 'component' | 'hook' | 'utility' | 'type' {
  if (name.startsWith('use')) return 'hook'
  if (name.endsWith('Props') || name.endsWith('Type')) return 'type'
  if (/^[A-Z]/.test(name)) return 'component'
  return 'utility'
}

function buildInventory(): ComponentEntry[] {
  const inventory: ComponentEntry[] = []

  for (const layer of LAYERS) {
    const layerDir = join(SHARED_DIR, layer)
    if (!existsSync(layerDir)) continue

    const scanDir = (dir: string, relativePrefix: string) => {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry)
        const relPath = relative(SHARED_DIR, fullPath)

        if (statSync(fullPath).isDirectory()) {
          scanDir(fullPath, join(relativePrefix, entry))
          continue
        }

        if (!entry.endsWith('.tsx') && !entry.endsWith('.ts')) continue
        // Skip index files and test files
        if (entry === 'index.ts' || entry.includes('.test.')) continue

        const name = entry.replace(/\.(tsx|ts)$/, '')
        const exports = scanExports(fullPath)
        const mainExport = exports.find(e => /^[A-Z]/.test(e)) || name
        const propsInterface = findPropsInterface(fullPath, mainExport)

        inventory.push({
          name,
          path: relPath,
          type: categorizeExport(mainExport),
          exports,
          propsInterface,
          layer: layer as ComponentEntry['layer'],
        })
      }
    }

    scanDir(layerDir, layer)
  }

  return inventory
}

const inventory = buildInventory()

// Output as JSON for machine consumption
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(inventory, null, 2))
  process.exit(0)
}

// Pretty print
console.log('=== Component Inventory ===\n')

const grouped = {
  components: inventory.filter(e => e.type === 'component'),
  hooks: inventory.filter(e => e.type === 'hook'),
  utilities: inventory.filter(e => e.type === 'utility' || e.type === 'type'),
}

for (const [group, items] of Object.entries(grouped)) {
  if (items.length === 0) continue
  console.log(`--- ${group.toUpperCase()} (${items.length}) ---`)
  for (const item of items) {
    const props = item.propsInterface ? ` [props: ${item.propsInterface}]` : ''
    const exports = item.exports.length > 1 ? ` (also exports: ${item.exports.filter(e => e !== item.name && !e.includes('Props')).join(', ')})` : ''
    console.log(`  ${item.name.padEnd(25)} ${item.layer.padEnd(10)} ${item.path}${props}${exports}`)
  }
  console.log()
}

console.log(`Total: ${inventory.length} exports (${grouped.components.length} components, ${grouped.hooks.length} hooks, ${grouped.utilities.length} utilities)`)
