import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const AI_DIR = path.join(SRC_DIR, 'main', 'ai');
const WORKSPACE_DIR = path.join(SRC_DIR, 'main', 'workspace');
const CONFIG_DIR = path.join(SRC_DIR, 'main', 'config');
const THEME_DIR = path.join(SRC_DIR, 'main', 'theme');
const FILE_DIR = path.join(SRC_DIR, 'main', 'file');
const SYSTEM_DIR = path.join(SRC_DIR, 'main', 'system');
const SPELLS_DIR = path.join(SRC_DIR, 'main', 'spells');
const LIB_DIR = path.join(SRC_DIR, 'lib');

const SUBSYSTEMS = [
  { dir: AI_DIR, name: 'ai' },
  { dir: WORKSPACE_DIR, name: 'workspace' },
  { dir: CONFIG_DIR, name: 'config' },
  { dir: THEME_DIR, name: 'theme' },
  { dir: FILE_DIR, name: 'file' },
  { dir: SYSTEM_DIR, name: 'system' },
  { dir: SPELLS_DIR, name: 'spells' }
];

interface AuditIssue {
  type: string;
  file: string;
  line: number;
  snippet: string;
  message: string;
}

interface ViolationRule {
  key: string;
  name: string;
  description: string;
  regex?: RegExp;
  anyRegex?: RegExp;
}

const VIOLATIONS: Record<string, ViolationRule> = {
  IMPORT_BOUNDARY: {
    key: 'import',
    name: 'Import Boundary Violation',
    description: 'Enforce module isolation (External -> AI/index only; AI -> Lib or sibling only).'
  },
  DIRECT_FS_USAGE: {
    key: 'fs',
    name: 'Direct FS Usage',
    regex: /\bfs\.(?:readFile|writeFile|mkdir|readdir|stat|appendFile|unlink)(?:Sync)?\b/g,
    description: 'Use standardized I/O helpers from src/lib/path.ts (readJson, writeJson, ensureDir, etc.) instead of raw fs calls.'
  },
  MANUAL_PATH_JOIN: {
    key: 'path',
    name: 'Manual Path Construction',
    regex: /\b(?:join|joinPaths|resolve|getAbsolutePath)\s*\(\s*(?:getAyniteDir\(\)|AYNITE_DIR|getAyniteConfigDir\(\)|getAynitePath\(\)|__dirname)\b/g,
    description: 'Use specialized path helpers from lib/path.ts (e.g., getWorkspacesConfigPath, getAIConfigPath) instead of manual joining with base directories.'
  },
  STRICT_TYPING: {
    key: 'types',
    name: 'Strict Typing Violation',
    anyRegex: /\bany\b/g,
    description: 'Avoid use of "any". Use more specific types (e.g., define proper interfaces instead).'
  },
  HARDCODED_STRINGS: {
    key: 'strings',
    name: 'Hardcoded AI Logic Strings',
    regex: /(?:content|prompt|message|description|name):\s*['"`]([^'"`]{50,})['"`]/g,
    description: 'Move large prompt strings, tool metadata, or system messages to lib/constants/ai.ts.'
  },
  DIRECT_PATH_IMPORT: {
    key: 'path-import',
    name: 'Direct Path Module Import',
    regex: /import\s+.*\s+from\s+['"]path['"]/g,
    description: 'Avoid direct "path" module imports. Use standardized path helpers from src/lib/path.ts instead.'
  },
  FORBIDDEN_PATH_FUNCTIONS: {
    key: 'path-func',
    name: 'Forbidden Path Functions',
    regex: /(?<!\.)\b(?:join|dirname|resolve|extname|basename)\b(?!\s*:)(?=\s*\()|(?<!\.)\bsep\b(?!\s*:)/g,
    description: 'Do not use raw path functions (join, dirname, etc.). Use project-specific path getters or their abstracted wrappers (joinPaths, getDirname, etc.) from lib/path.ts.'
  },
  TS_IGNORE: {
    key: 'ts-ignore',
    name: 'Stale @ts-ignore Comment',
    regex: /\/\/\s*@ts-ignore/g,
    description: 'Avoid @ts-ignore comments. Declare proper types (e.g., add missing methods to the AyniteWindow interface) instead of suppressing type errors.'
  }
};

// Help display
if (process.argv.includes('-h') || process.argv.includes('--help')) {
  console.log('\nAynite Main Architecture Auditor');
  console.log('Usage: npm run audit:main -- [options]\n');
  console.log('Options:');
  console.log('  --focus=[type]    Only run specific checks (import, fs, path, types, strings)');
  console.log('  --folder=[path]   Audit a specific folder or file');
  console.log('  -h, --help        Show this help message\n');
  console.log('Examples:');
  console.log('  npm run audit:main -- --focus=fs');
  console.log('  npm run audit:main -- --folder=src/main/ai\n');
  process.exit(0);
}

// Arguments
const focusArg = process.argv.find(arg => arg.startsWith('--focus='))?.split('=')[1];
const folderArg = process.argv.find(arg => arg.startsWith('--folder='))?.split('=')[1];

const activeViolations = focusArg
  ? Object.values(VIOLATIONS).filter(v => v.key === focusArg || v.name.toLowerCase().includes(focusArg))
  : Object.values(VIOLATIONS);

const targetFolders = folderArg 
  ? [path.resolve(ROOT_DIR, folderArg)] 
  : [path.join(SRC_DIR, 'main'), path.join(SRC_DIR, 'lib')];

function walk(dir: string, callback: (f: string) => void) {
  if (!fs.existsSync(dir)) return;
  
  const stats = fs.statSync(dir);
  if (!stats.isDirectory()) {
    if (dir.endsWith('.ts')) callback(dir);
    return;
  }

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filepath = path.join(dir, file);
    const fStats = fs.statSync(filepath);
    if (fStats.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        walk(filepath, callback);
      }
    } else if (file.endsWith('.ts')) {
      callback(filepath);
    }
  });
}

const report: AuditIssue[] = [];

const auditFile = (filepath: string) => {
  const relativePath = path.relative(ROOT_DIR, filepath);
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');

  // 1. Import Boundary Audit
  if (activeViolations.some(v => v.key === 'import')) {
    const importRegex = /import\s+.*\s+from\s+['"](.*)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const lineNum = content.substring(0, match.index).split('\n').length;

      if (importPath.startsWith('.')) {
        const resolvedPath = path.resolve(path.dirname(filepath), importPath);
        
        const currentSubsystem = SUBSYSTEMS.find(s => filepath.startsWith(s.dir));
        const targetSubsystem = SUBSYSTEMS.find(s => resolvedPath.startsWith(s.dir));
        
        let violation = false;
        let msg = '';

        if (!currentSubsystem) {
          // Outside any subsystem (e.g. src/main/index.ts)
          if (targetSubsystem) {
            const targetIndex = path.join(targetSubsystem.dir, 'index');
            const targetIsIndex = resolvedPath === targetIndex || resolvedPath === `${targetIndex}.ts` || resolvedPath === targetSubsystem.dir;
            if (!targetIsIndex) {
              violation = true;
              msg = `External modules should only import from src/main/${targetSubsystem.name}/index.ts to maintain subsystem isolation.`;
            }
          }
        } else {
          // Inside a subsystem
          const targetIsInsideLib = resolvedPath.startsWith(LIB_DIR);
          const targetIsInsideSameSubsystem = targetSubsystem && targetSubsystem.dir === currentSubsystem.dir;
          const targetIsSibling = path.dirname(resolvedPath) === path.dirname(filepath);

          if (!targetIsInsideLib && !targetIsInsideSameSubsystem) {
            // Importing from another subsystem or elsewhere
            if (targetSubsystem) {
              const targetIndex = path.join(targetSubsystem.dir, 'index');
              const targetIsIndex = resolvedPath === targetIndex || resolvedPath === `${targetIndex}.ts` || resolvedPath === targetSubsystem.dir;
              if (!targetIsIndex) {
                violation = true;
                msg = `Subsystems should only import from src/main/${targetSubsystem.name}/index.ts of other subsystems.`;
              }
            }
          }
        }

        if (violation) {
          report.push({
            type: VIOLATIONS.IMPORT_BOUNDARY.name,
            file: relativePath,
            line: lineNum,
            snippet: lines[lineNum - 1].trim(),
            message: msg
          });
        }
      }
    }
  }

  // 2. Direct FS Usage
  if (activeViolations.some(v => v.key === 'fs') && !filepath.endsWith('src/lib/path.ts')) {
    let fsMatch;
    while ((fsMatch = VIOLATIONS.DIRECT_FS_USAGE.regex.exec(content)) !== null) {
      const lineNum = content.substring(0, fsMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.DIRECT_FS_USAGE.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.DIRECT_FS_USAGE.description
      });
    }
  }

  // 3. Manual Path Join
  if (activeViolations.some(v => v.key === 'path') && !filepath.endsWith('src/lib/path.ts')) {
    let pathMatch;
    while ((pathMatch = VIOLATIONS.MANUAL_PATH_JOIN.regex.exec(content)) !== null) {
      const lineNum = content.substring(0, pathMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.MANUAL_PATH_JOIN.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.MANUAL_PATH_JOIN.description
      });
    }
  }

  // 4. Strict Typing
  if (activeViolations.some(v => v.key === 'types')) {
    // Audit for 'any'
    let anyMatch;
    while ((anyMatch = VIOLATIONS.STRICT_TYPING.anyRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, anyMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.STRICT_TYPING.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: 'Detected usage of "any". Use more specific types.'
      });
    }

  }

  // 5. Hardcoded Strings
  if (activeViolations.some(v => v.key === 'strings')) {
    let strMatch;
    while ((strMatch = VIOLATIONS.HARDCODED_STRINGS.regex.exec(content)) !== null) {
      const lineNum = content.substring(0, strMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.HARDCODED_STRINGS.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.HARDCODED_STRINGS.description
      });
    }
  }

  // 6. Direct Path Module Import
  if (activeViolations.some(v => v.key === 'path-import') && !filepath.endsWith('src/lib/path.ts')) {
    let pathMatch;
    while ((pathMatch = VIOLATIONS.DIRECT_PATH_IMPORT.regex.exec(content)) !== null) {
      const lineNum = content.substring(0, pathMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.DIRECT_PATH_IMPORT.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.DIRECT_PATH_IMPORT.description
      });
    }
  }
  // 7. Forbidden Path Functions
  if (activeViolations.some(v => v.key === 'path-func') && !filepath.endsWith('src/lib/path.ts')) {
    let pathMatch;
    while ((pathMatch = VIOLATIONS.FORBIDDEN_PATH_FUNCTIONS.regex.exec(content)) !== null) {
      const lineNum = content.substring(0, pathMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.FORBIDDEN_PATH_FUNCTIONS.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.FORBIDDEN_PATH_FUNCTIONS.description
      });
    }
  }

  // 8. Stale @ts-ignore Comments
  if (activeViolations.some(v => v.key === 'ts-ignore')) {
    let tsIgnoreMatch;
    while ((tsIgnoreMatch = VIOLATIONS.TS_IGNORE.regex.exec(content)) !== null) {
      const lineNum = content.substring(0, tsIgnoreMatch.index).split('\n').length;
      report.push({
        type: VIOLATIONS.TS_IGNORE.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.TS_IGNORE.description
      });
    }
  }
};

targetFolders.forEach(folder => walk(folder, auditFile));

const grouped: Record<string, AuditIssue[]> = report.reduce((acc: Record<string, AuditIssue[]>, item) => {
  if (!acc[item.type]) acc[item.type] = [];
  acc[item.type].push(item);
  return acc;
}, {});

const DISPLAY_ORDER = Object.values(VIOLATIONS).map(v => v.name);

console.log('\n=================================================');
console.log('      Aynite Main Architecture Audit');
if (focusArg) console.log(`      FOCUS: ${focusArg}`);
if (folderArg) console.log(`      FOLDER: ${folderArg}`);
console.log('=================================================\n');

if (report.length === 0) {
  console.log('✅ EXCELLENT: No architectural violations found!\n');
} else {
  DISPLAY_ORDER.forEach(typeName => {
    const items = grouped[typeName] || [];
    if (items.length === 0) return;

    const badge = typeName === VIOLATIONS.IMPORT_BOUNDARY.name ? '🚨 ARCHITECTURE' : 
                  typeName === VIOLATIONS.STRICT_TYPING.name ? '🚨 TYPING' :
                  typeName === VIOLATIONS.DIRECT_FS_USAGE.name ? '⚠️ WARNING' :
                  typeName === VIOLATIONS.MANUAL_PATH_JOIN.name ? '⚠️ WARNING' : '📝 NOTICE';

    console.log(`>>> ${badge}: ${typeName} (${items.length} issues) <<<`);
    console.log('-'.repeat(typeName.length + 25));
    
    items.forEach(item => {
      console.log(`[${item.file}:${item.line}] ${item.snippet}`);
      console.log(`   └─ ${item.message}\n`);
    });
  });

  console.log('=================================================');
  console.log(`TOTAL POTENTIAL ISSUES: ${report.length}`);
  DISPLAY_ORDER.forEach(typeName => {
    if (focusArg && !activeViolations.some(v => v.name === typeName)) return;
    const count = grouped[typeName]?.length || 0;
    const status = count > 0 ? (typeName === VIOLATIONS.IMPORT_BOUNDARY.name || typeName === VIOLATIONS.STRICT_TYPING.name ? '🔴 FIX REQUIRED' : '🟡 REFAC OR REVIEW') : '🟢 CLEAN';
    console.log(` - ${typeName}: ${count} [${status}]`);
  });
}
console.log('\n=== End of Report ===\n');
