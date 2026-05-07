const path = require('node:path')
const fs = require('node:fs')

const appPath = process.cwd() // Assuming we run from root
const bundledPlaybookPath = path.join(appPath, 'resources', 'aynite-playbook')
console.log('Bundled Playbook Path:', bundledPlaybookPath)
console.log('Exists:', fs.existsSync(bundledPlaybookPath))

const configDir = path.join(process.env.HOME, '.aynite')
const destDir = path.join(configDir, 'aynite-playbook')
console.log('Dest Dir:', destDir)
console.log('Dest Exists:', fs.existsSync(destDir))
