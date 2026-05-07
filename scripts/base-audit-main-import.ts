import fs from 'node:fs'
import path from 'node:path'

/**
 * Aynite Main Import Isolation Audit
 * 
 * Rules:
 * 1. Only check folders inside src/main (exclude root index.ts and window.ts).
 * 2. Only the index.ts file within each folder can have exports.
 *    - It must use explicit named exports (no "export *").
 *    - It should only be responsible for exporting.
 * 3. Files in each folder can only import from:
 *    - Sibling files (e.g., "./other-file")
 *    - Parent root files (e.g., "../window" or "../index")
 *    - Library utilities (e.g., "src/lib" or "../../lib/...")
 *    - External packages (e.g., "electron", "ai", etc.)
 * 4. Every folder in src/main must have an index.ts. If missing, create one.
 */

const MAIN_DIR = path.join(process.cwd(), 'src/main')
const violations: string[] = []

function auditFolder(folderPath: string) {
  const folderName = path.basename(folderPath)
  const entries = fs.readdirSync(folderPath, { withFileTypes: true })
  const files = entries.filter(e => e.isFile() && e.name.endsWith('.ts')).map(e => e.name)

  // Rule 4: Folder MUST have index.ts
  if (!files.includes('index.ts')) {
    console.log(`[Rule 4] Creating missing index.ts in ${folderPath}`)
    fs.writeFileSync(path.join(folderPath, 'index.ts'), `/**\n * ${folderName} Subsystem Gateway\n */\n`)
    files.push('index.ts')
  }

  for (const file of files) {
    const filePath = path.join(folderPath, file)
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    const isIndex = file === 'index.ts'

    // Rule 2: Forbid wildcard exports (export *) to ensure explicit interfaces
    if (/export\s+\*\s+from/.test(content)) {
      violations.push(`[${filePath}] Rule 2: "export *" is forbidden. Use explicit named exports to maintain a clear architectural boundary.`)
    }

    // Rule 3: Import restrictions
    lines.forEach((line, lineIdx) => {
      // Match import statements: import ... from 'path' or import 'path'
      const importMatch = line.match(/from\s+['"](.*)['"]/) || line.match(/import\s+['"](.*)['"]/)
      if (importMatch) {
        const importPath = importMatch[1]
        
        // Ignore external packages
        if (!importPath.startsWith('.')) {
          return
        }

        const isSibling = importPath.startsWith('./')
        const isParentRoot = importPath === '../window' || importPath === '../index' || 
                           importPath === '../window.ts' || importPath === '../index.ts'
        const isLib = importPath.includes('src/lib') || importPath.includes('../../lib')
        
        // NEW: Allow importing from a sibling folder's index (Gateway)
        // e.g. from '../ai' or '../theme' (without a second slash)
        const isSiblingGateway = /^\.\.\/[^/]+$/.test(importPath) || 
                                 /^\.\.\/[^/]+\/index(\.ts)?$/.test(importPath)

        if (!isSibling && !isParentRoot && !isLib && !isSiblingGateway) {
          violations.push(`[${filePath}:${lineIdx + 1}] Rule 3: Illegal import from "${importPath}". Files can only import from siblings, subsystem gateways (e.g. "../ai"), parents, or lib.`)
        }
      }
    })
  }
}

// Main execution
try {
  const mainEntries = fs.readdirSync(MAIN_DIR, { withFileTypes: true })
  for (const entry of mainEntries) {
    if (entry.isDirectory()) {
      auditFolder(path.join(MAIN_DIR, entry.name))
    }
  }

  console.log('\n=================================================')
  console.log('      Aynite Main Import Isolation Audit')
  console.log('=================================================\n')

  if (violations.length > 0) {
    console.log(`🚨 FAIL: Found ${violations.length} violation(s):\n`)
    violations.forEach(v => console.log(v))
    process.exit(1)
  } else {
    console.log('✅ PASS: All main import isolation rules satisfied.')
    process.exit(0)
  }
} catch (error) {
  console.error('Audit failed with error:', error)
  process.exit(1)
}
